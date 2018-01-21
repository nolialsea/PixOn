var express = require('express');
var app = express();
var port = 4201;	//4200 is prod, 4201 is uat
var server = app.listen(port);
var io = require('socket.io').listen(server);
var sqlite3 = require('sqlite3').verbose();
var md5 = require('md5');
console.log(port+' is the magic port');
app.set('view engine', 'ejs');
app.use('/views', express.static(__dirname + '/views'));


var db = new sqlite3.Database('db.db');

db.serialize(function() {

  db.run("CREATE TABLE IF NOT EXISTS Pixel("+
      "id INTEGER PRIMARY KEY,"+
      "x INTEGER,"+
      "y INTEGER,"+
      "r INTEGER,"+
      "g INTEGER,"+
      "b INTEGER,"+
      "channel INTEGER DEFAULT 0,"+
      "owner INTEGER,"+
      "dateCreation INTEGER"+
  ")");

});

app.get('*', function(req, res) {
	res.render('index');
});

var conf = {
    gridSize: 6,
    gridWidth: 128,
    gridHeight: 128,
    nbChannel: 1
};


//PixOn
function getPixel(arg0, arg1, arg2, arg3, arg4, arg5){
    return {channel: arg0, r:arg1,g:arg2,b:arg3,x:arg4,y:arg5};
}

function insertPixel(pix){
    var stmt = db.prepare("INSERT INTO Pixel (x, y, r, g, b, channel, dateCreation) VALUES (?,?,?,?,?,?,?)");
    stmt.run(pix.x, pix.y, pix.r, pix.g, pix.b, pix.channel, new Date().getTime());
    stmt.finalize();
}


function getPixelFromPosition(pixelX, pixelY, callback){
    db.each("SELECT * FROM Task WHERE x="+pixelX+", y="+pixelY+" GROUP BY id", function(err, row){
        if (!err){
            callback(row);
        }
    });
}

function insertPixels(pixs){
    var stmt = db.prepare("INSERT INTO Pixel (x, y, r, g, b, channel, dateCreation) VALUES (?,?,?,?,?,?,?)");
    for (var i=0; i<pixs.length; i++){
        var pix = pixs[i];
        stmt.run(pix.x, pix.y, pix.r, pix.g, pix.b, pix.channel, new Date().getTime());
    }
    stmt.finalize();
}

function getAllPixels(callback){
    db.serialize(function() {
        db.all("SELECT * FROM Pixel GROUP BY x, y ORDER BY id DESC", function(err, rows) {
            if (!err){
                callback(rows);
            }
        });
    });
}

function getAllPixelsAt(timestamp, callback){
    db.serialize(function() {
        db.all("SELECT * FROM Pixel WHERE dateCreation < "+timestamp+" GROUP BY x, y ORDER BY id DESC", function(err, rows) {
            if (!err){
                callback(rows);
            }
        });
    });
}

function getLastPixelAt(x, y, callback){
    db.all("SELECT * FROM Pixel WHERE x="+x+", y="+y+" ORDER BY id DESC", function(err, rows) {
        if (!err){
            callback(rows);
        }
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

io.on('connection', function (socket) {
    socket.emit('init', {conf: conf});
    socket.data = {
      login: "",
      userId: 0
    };

    getAllPixels(function(rows){
        socket.emit('pixels', rows);
    });

    socket.on('getAllPixelsAt', function (timestamp) {
        getAllPixelsAt(timestamp, function(rows){
            socket.emit('allPixelsAt', rows);
        });
    });

    socket.on('pixel', function (pixel) {
        if (validatePixel(pixel)){
          io.emit('pixel', pixel);
          insertPixel(pixel);

        }
    });

    socket.on('pixels', function (pixels) {
      io.emit('pixels', pixels);
      insertPixels(pixels);
    });

    socket.on('c', function (c) {
        if (c == "clear"){
            //Clear the canvas here
        }
    });

    
    socket.on('disconnect', function () {

    });
});
