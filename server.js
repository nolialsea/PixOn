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
  db.run("CREATE TABLE IF NOT EXISTS UserRank("+
      "id INTEGER PRIMARY KEY,"+
      "name TEXT UNIQUE"+
  ")");

  db.run("CREATE TABLE IF NOT EXISTS User("+
      "id INTEGER PRIMARY KEY, "+
      "login TEXT UNIQUE,"+
      "password TEXT,"+
      "rank INTEGER,"+
      "dateCreation INTEGER"+
  ")");

  db.run("CREATE TABLE IF NOT EXISTS TaskState("+
      "id INTEGER PRIMARY KEY,"+
      "name TEXT UNIQUE"+
  ")");

  db.run("CREATE TABLE IF NOT EXISTS TaskFeature("+
      "id INTEGER PRIMARY KEY,"+
      "name TEXT UNIQUE"+
  ")");

  db.run("CREATE TABLE IF NOT EXISTS Task("+
      "id INTEGER PRIMARY KEY,"+
      "feature INTEGER,"+
      "task TEXT,"+
      "owner INTEGER,"+
      "state INTEGER,"+
      "dateCreation INTEGER"+
  ")");

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

  db.all("SELECT id FROM TaskState", function(err, rows){
    if (!err && (!rows || rows.length == 0)){
      var stmt = db.prepare("INSERT INTO TaskFeature (name) VALUES (?)");
      stmt.run("General");
      stmt.run("Pixon");
      stmt.run("Todo");
      stmt.run("Account");
      stmt.run("Scripting");
      stmt.run("Code");
      stmt.finalize();

      stmt = db.prepare("INSERT INTO TaskState (name) VALUES (?)");
      stmt.run("None");
      stmt.run("Accepted");
      stmt.run("Refused");
      stmt.run("In progress");
      stmt.run("Paused");
      stmt.run("Finished");
      stmt.finalize();

      stmt = db.prepare("INSERT INTO UserRank (name) VALUES (?)");
      stmt.run("Admin");
      stmt.run("Moderator");
      stmt.run("Contributor");
      stmt.run("Banned");
      stmt.finalize();
    }
  })

});

app.get('/todo', function(req, res) {
  getAllTaskFeatures(function(taskFeatures){
    getAllTaskStates(function(taskStates){
      res.render('todo', {taskFeatures: taskFeatures, taskStates: taskStates});
    });
  });
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

//Account
function insertUser(login, password, callback){
  getUserByLogin(login, function(user){
    if(user == null){
      var stmt = db.prepare("INSERT INTO User (login, password, rank, dateCreation) VALUES (?,?,?,?)");
      stmt.run(login, md5(password), 0, new Date().getTime());
      stmt.finalize();
      callback(true);
    }else{
      callback(false);
    }
  });
}

function getUserByLogin(userLogin, callback){
  db.all("SELECT * FROM User WHERE login='"+userLogin+"'", function(err, rows) {
    if (!err){
      if (rows.length == 1){
        callback(rows[0]);
      }else{
        callback(null);
      }
    }else{
      callback(null);
    }
  });
}

function getUserById(userId, callback){
  db.all("SELECT * FROM User WHERE id="+userId, function(err, rows) {
    if (!err){
      if (rows.length == 1){
        callback(rows[0]);
      }else{
        callback(null);
      }
    }else{
      callback(null);
    }
  });
}

function authenticateUser(userLogin, userPassword, callback){
  getUserByLogin(userLogin, function(user){
    if (user != null){
      if (user.password == md5(userPassword)){
        callback(true);
      }else{
        callback(false);
      }
    }else{
      insertUser(userLogin, userPassword, function(result){
        callback(result);
      });
    }
  });
}

//Todo list
function insertTask(task, userId){
  var stmt = db.prepare("INSERT INTO Task (task, owner, state, feature, dateCreation) VALUES (?,?,?,?,?)");
  stmt.run(task.task, userId, 1, task.feature, new Date().getTime());
  stmt.finalize();
}

function deleteTask(taskId, callback){
  var stmt = db.prepare("DELETE FROM Task WHERE id ="+taskId);
  stmt.run();
  stmt.finalize();
  callback();
}

function getTask(taskId, callback){
  db.serialize(function() {
    db.each("SELECT * FROM Task WHERE id="+taskId, function(err, row) {
      if (!err){
        callback(row);
      }
    });
  });
}

function getLastTask(callback){
  db.serialize(function() {
    db.each("SELECT * FROM Task ORDER BY id DESC LIMIT(1)", function(err, row) {
      if (!err){
        getUserById(row.owner, function(user){
          if (user){
            row.owner = user.login;
            callback(row);
          }else{
            callback(null);
          }
        });
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

function getAllTaskFeatures(callback){
    db.all("SELECT * FROM TaskFeature", function(err, rows) {
        if (!err){
            callback(rows);
        }
    });
}

function getAllTaskStates(callback){
    db.all("SELECT * FROM TaskState", function(err, rows) {
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
    socket.data = {
      login: "",
      userId: 0
    };

    getAllPixels(function(rows){
        socket.emit('pixels', rows);
    });

    socket.on('login', function(user){
      user.login = user.login.trim();
      authenticateUser(user.login, user.password, function(success){
        if (success){
          getUserByLogin(user.login, function(user_){
            socket.data.login = user.login;
            socket.data.userId = user_.id;
            socket.emit('login', user_.id);
            getAllTasks(function(rows){
                socket.emit('allTasks', rows);
            });
          });
        }else{
          socket.emit('login', null);
        }

      });
    });

    socket.on('getAllTasks', function(){
      getAllTasks(function(rows){
          socket.emit('allTasks', rows);
      });
    });

    socket.on('changeTaskState', function(data){
      if (socket.data.userId != 0){
        db.serialize(function(){
          db.run("UPDATE Task SET state='"+data.taskStateId+"' WHERE id="+data.taskId+"");
          getAllTasks(function(rows){
              io.emit('allTasks', rows);
          });
        });
      }
    });

    socket.on('changeTaskFeature', function(data){
      if (socket.data.userId != 0){
        db.serialize(function(){
          db.run("UPDATE Task SET feature='"+data.taskFeatureId+"' WHERE id="+data.taskId+"");
          getAllTasks(function(rows){
              io.emit('allTasks', rows);
          });
        });
      }
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

    socket.on('task', function(task){
      if (socket.data.userId != 0){
        insertTask(task, socket.data.userId);
        getAllTasks(function(rows){
          io.emit('allTasks', rows);
        });
      }
    });

    socket.on('deleteTask', function(taskId){
      if (socket.data.userId != 0){
        getTask(taskId, function(task){
          if (task.owner == socket.data.userId){
            deleteTask(taskId, function(){
              getAllTasks(function(rows){
                  io.emit('allTasks', rows);
              });
            });
          }
        })

      }
    });

    socket.on('getAllTasks', function () {
      getAllTasks(function(tasks){
        socket.emit('allTasks', tasks);
      });
    });

    socket.on('disconnect', function () {

    });
});
