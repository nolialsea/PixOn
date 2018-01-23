var express = require('express');
var app = express();
var port = 4201;	//4200 is prod, 4201 is uat
var server = app.listen(port);
var io = require('socket.io').listen(server);
console.log(port+' is the magic port');
app.set('view engine', 'ejs');
app.use('/views', express.static(__dirname + '/views'));

var Database = require("Database.js");
var db = Database.db;

var pixelCounter = 0;
var saveEveryXPixel = 128;

var conf = {
    gridSize: 6,
    gridWidth: 128,
    gridHeight: 128,
    nbChannel: 1
};

var Canvas = require('canvas')
    , Image = Canvas.Image
    , canvas = new Canvas(conf.gridWidth, conf.gridHeight)
    , ctx = canvas.getContext('2d');

app.get('/', function(req, res) {
    res.render('index');
});

app.get('/archive', function(req, res) {
    const folder = './views/archive/';
    const fs = require('fs');
    let files = [];

    fs.readdirSync(folder).forEach(file => {
        files.push(file);
    })

    res.render('archive', {files});
});

function drawPixel(pix){
    ctx.fillStyle = "#" + toHex(pix);
    ctx.fillRect(pix.x, pix.y, 1, 1);
    pixelCounter++
    if (pixelCounter >= saveEveryXPixel){
        pixelCounter = 0;
        saveCanvas();
    }
}

function drawPixels(pixs){
    pixelCounter -= pixs.length;
    for (var i = 0; i < pixs.length; i++) {
        drawPixel(pixs[i]);
    }
    saveCanvas();
}

function saveCanvas(){
    let timestamp = new Date().getTime()
    var fs = require('fs')
        , out = fs.createWriteStream(__dirname + '/views/archive/'+timestamp+'.png')
        , stream = canvas.pngStream();

    stream.on('data', function(chunk){
        out.write(chunk);
    });

    stream.on('end', function(){
        getAllPixels((pixs)=>{
            io.of("/pixon").emit('pixels', pixs);
            io.of("/pixonArchive").emit('newSave', [
                canvas.toDataURL('image/jpeg', 1.0),
                new Date(timestamp)
            ]);
        });
    });
}

function toHex(pix){
    var hex = "";
    var p = [pix.r,pix.g,pix.b];
    for (var i=0; i<p.length; i++){
        var h = "";
        try{
            h = p[i].toString(16);
        }catch(e){
            
        }
        if (h.length == 1){
            h = "0" + h;
        }
        hex += h;
    }
    return hex;
}

//PixOn
function getPixel(arg){
    return {x: arg[0], y:arg[1], r:arg[2], g:arg[3], b:arg[4], channel:arg[5]};
}

function insertPixel(pix){
    db.query(
        "INSERT INTO PixelLive (x, y, r, g, b, channel, dateCreation) VALUES (?,?,?,?,?,?,?)"
        +" ON DUPLICATE KEY UPDATE r=?, g=?, b=?",
        [pix.x, pix.y, pix.r, pix.g, pix.b, pix.channel, new Date().getTime(), pix.r, pix.g, pix.b],
        function(err) {
            if (err) throw err;
        }
    );

    db.query(
        "INSERT INTO Pixel (x, y, r, g, b, channel, dateCreation) VALUES (?,?,?,?,?,?,?)",
        [pix.x, pix.y, pix.r, pix.g, pix.b, pix.channel, new Date().getTime()],
        function(err) {
            if (err) throw err;
        }
    );
}

function insertPixels(pixs){
    for (var i = 0; i < pixs.length; i++) {
        insertPixel(pixs[i]);
    }
    /*let stmt = [];
    for (var i=0; i<pixs.length; i++){
        stmt.push([pixs[i].x, pixs[i].y, pixs[i].r, pixs[i].g, pixs[i].b, pixs[i].channel, new Date().getTime(), pixs[i].r, pixs[i].g, pixs[i].b]);
    }
    db.query(
        "INSERT INTO PixelLive (x, y, r, g, b, channel, dateCreation) VALUES (?,?,?,?,?,?,?)"
        +" ON DUPLICATE KEY UPDATE r=?, g=?, b=?",
        [stmt],
        function(err) {
            if (err) throw err;
        }
    );*/
}

function pixel(arg0, arg1, arg2, arg3, arg4, arg5){
    var pix = {channel: arg0,r:arg1,g:arg2,b:arg3,x:arg4,y:arg5};
    if (arg5 != null){
        pix.channel = arg0;
        pix.r = arg1;
        pix.g = arg2;
        pix.b = arg3;
        pix.x = arg4;
        pix.y = arg5;
    }else if(arg3 != null){
        pix.channel = arg0;
        pix.r = parseInt(arg1.substring(0,2),16);
        pix.g = parseInt(arg1.substring(2,4),16);
        pix.b = parseInt(arg1.substring(4,6),16);
        pix.x = arg2;
        pix.y = arg3;
    }
    return pix;
}

function clear(colorHex="#ffffff"){
    let pixs = [];
    for (var i = 0; i < conf.gridWidth; i++) {
        for (var j = 0; j < conf.gridHeight; j++) {
            pixs.push(pixel(0, colorHex.substr(1), i, j));
        }
    }

    drawPixels(pixs);
    insertPixels(pixs);
}

function loadPixelsInDatabase(callback){
    db.query('SELECT x, y, r, g, b, channel FROM PixelLive', function (error, results, fields) {
        if (error) throw error;
        if(results.length == 0){
            clear("#ffffff");
            console.log("First Clear");
        }else{
            drawPixels(results);
        }
        
        callback();
    });
};

function getAllPixels(callback){
    /*db.query('SELECT x, y, r, g, b, channel FROM PixelLive', function (error, results, fields) {
        if (error) throw error;
        callback(results);
    });*/

    var imgd = ctx.getImageData(0, 0, conf.gridWidth, conf.gridHeight).data;
    var pixels = [];
    for (var i = 0; i < imgd.length; i+=4) {
        pixels.push(pixel(0,imgd[i],imgd[i+1],imgd[i+2],(i/4)%conf.gridWidth,Math.floor((i/4)/conf.gridWidth)));
    }
    callback(pixels);
}

function getAllPixelsAt(timestamp, callback){
    db.query("SELECT x, y, r, g, b, channel FROM Pixel WHERE dateCreation < ? GROUP BY x, y ORDER BY id DESC", timestamp, function(err, results, fields) {
        if (err) throw err;
        callback(results);
    });
}

function validatePixel(pixel){
    if (pixel.channel >= 0 && pixel.channel < conf.nbChannel && pixel.x >= 0  && pixel.x < conf.gridWidth
    && pixel.y >= 0 && pixel.y < conf.gridHeight){
        return true;
    }else{
        return false;
    }
}

loadPixelsInDatabase(()=>{
    io.of("/pixonArchive").on('connection', function (socket) {

    });

    io.of("/pixon").on('connection', function (socket) {
        socket.emit('init', {conf: conf});
        socket.data = {
          login: "",
          userId: 0
        };

        io.of("/pixon").emit('nbConnected', Object.keys(io.sockets.sockets).length);

        getAllPixels(function(pixs){
            socket.emit('pixels', pixs);
        });

        socket.on('getAllPixelsAt', function (timestamp) {
            getAllPixelsAt(timestamp, function(rows){
                socket.emit('allPixelsAt', rows);
            });
        });

        socket.on('getAllPixels', function (timestamp) {
            getAllPixels(function(pixs){
                socket.emit('pixels', pixs);
            });
        });

        socket.on('pixel', function (pixel) {
            if (validatePixel(pixel)){
              io.of("pixon").emit('pixel', pixel);
              drawPixel(pixel);
              insertPixel(pixel);
            }
        });

        socket.on('pixels', function (pixels) {
            let valid = true;
            pixels = pixels.filter((e)=>validatePixel(e))
            
            if (pixels.length > 0){
                io.of("pixon").emit('pixels', pixels);
                drawPixels(pixels);
                insertPixels(pixels);
            }
        });

        socket.on('c', function (c) {
            if (c == "clear"){
                //Clear the canvas here
            }
        });
        
        socket.on('disconnect', function () {
            io.of("pixon").emit('nbConnected', Object.keys(io.sockets.sockets).length);
        });
    });

});