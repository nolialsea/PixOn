var express = require('express');
var app = express();
var port = 4201;	//4200 is prod, 4201 is uat
var server = app.listen(port);
var io = require('socket.io').listen(server);
var sqlite3 = require('sqlite3').verbose();
console.log(port+' is the magic port');
app.set('view engine', 'ejs');
app.use('/views', express.static(__dirname + '/views'));

var db = new sqlite3.Database('db.db');

db.serialize(function() {
    db.run("CREATE TABLE IF NOT EXISTS User("+
        "id INTEGER PRIMARY KEY, "+
        "login TEXT,"+
        "password TEXT,"+
        "rank INTEGER,"+
        "dateCreation INTEGER"+
    ")");
    db.run("CREATE TABLE IF NOT EXISTS Task("+
        "id INTEGER PRIMARY KEY,"+
        "feature INTEGER,"+
        "task TEXT,"+
        "owner INTEGER DEFAULT 0,"+
        "accepted INTEGER DEFAULT 0,"+
        "done INTEGER DEFAULT 0,"+
        "dateCreation INTEGER"+
    ")");
    db.run("CREATE TABLE IF NOT EXISTS TaskFeature("+
        "id INTEGER PRIMARY KEY,"+
        "name TEXT"+
    ")");
    db.run("CREATE TABLE IF NOT EXISTS TaskState("+
        "id INTEGER PRIMARY KEY,"+
        "name TEXT"+
    ")");
    db.run("CREATE TABLE IF NOT EXISTS Pixel("+
        "id INTEGER PRIMARY KEY,"+
        "x INTEGER,"+
        "y INTEGER,"+
        "r INTEGER,"+
        "g INTEGER,"+
        "b INTEGER,"+
        "channel INTEGER DEFAULT 0,"+
        "owner INTEGER DEFAULT 0,"+
        "dateCreation INTEGER"+
    ")");
});

app.get('/todo', function(req, res) {
	res.render('todo');
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

/*global pixelMap*/
pixelMap = [];
initPixelMap();
function initPixelMap(r,g,b){
    if (b == null){
        r = g = b = 255;
    }

    for (var channel=0; channel<conf.nbChannel; channel++){
        pixelMap[channel] = [];
        for (var i=0; i<conf.gridHeight; i++){
            pixelMap[channel][i] = [];
            for (var j=0; j<conf.gridWidth; j++){
                pixelMap[channel][i][j] = getPixel(channel, r,g,b,i,j);
            }
        }
    }
}

//Todo list
function insertTask(task){
    var stmt = db.prepare("INSERT INTO Task (task, owner, accepted, done, feature, dateCreation) VALUES (?,?,?,?,?,?)");
    stmt.run(task.task, 0,0,0, task.feature, new Date().getTime());
    stmt.finalize();
}

function deleteTask(taskId){
    var stmt = db.prepare("DELETE FROM Task WHERE id ="+taskId);
    stmt.run();
    stmt.finalize();
}

function getLastTask(callback){
    db.serialize(function() {
        db.each("SELECT * FROM Task ORDER BY id DESC LIMIT(1)", function(err, row) {
            if (!err){
                callback(row);
            }
        });
    });
}

function getAllTasks(callback){
    db.all("SELECT * FROM Task", function(err, rows) {
        if (!err){
            callback(rows);
        }
    });
}


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
            insertPixel(pixel);
            io.emit('pixel', pixel);
        }
    });

    socket.on('pixels', function (pixels) {
        insertPixels(pixels);
        io.emit('pixels', pixels);
    });

    socket.on('c', function (c) {
        if (c == "clear"){
            //Clear the canvas here
        }
    });

    socket.on('task', function(task){
        insertTask(task);
        getLastTask(function(task){
            io.emit('task', task);
        });
    });

    socket.on('deleteTask', function(taskId){
        deleteTask(taskId);
        io.emit('deleteTask', taskId);
    });

    socket.on('getAllTasks', function () {
        getAllTasks(function(tasks){
            socket.emit('allTasks', tasks);
        });
    });

    socket.on('disconnect', function () {

    });
});
