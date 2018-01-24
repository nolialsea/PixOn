/*
    TODO:
        - Maybe a login system to get some moderation ?
        - Limit number of pixel to be placed ?
            Idea: you have X pixels to place every Y time
*/

/*global $*/
/*global io*/
$("#colorPickerContainer").draggable({ handle: "#dragSpan" });
$("#canvasGrid").hide();

let drawingEnabled = true;
let initialized = true;

let mousePos = [-1,-1];
let savedPos = [[-1,-1], [-1,-1]];

var conf = {
    gridSize: 6,
    gridWidth: 128,
    gridHeight: 128,
    nbChannel: 1
};

$("#inpGridSize").on("change", (e)=>{
    conf.gridSize = parseInt($("#inpGridSize").val());
    resizeCanvas();
})

var channel = 0;

var pixelMap = [];
let lastPosAndColor = {x: -1, y: -1, color: null};
initPixelMap();

function initPixelMap(){
    pixelMap = [];
    for (var chan=0; chan<conf.nbChannel; chan++){
        pixelMap[chan] = [];
        for (var i=0; i<conf.gridHeight; i++){
            pixelMap[chan][i] = [];
            for (var j=0; j<conf.gridWidth; j++){
                pixelMap[chan][i][j] = pixel(chan,255,255,255,i,j);
            }
        }
    }
}


var canvas = document.getElementById("canvas");
var canvasGrid = document.getElementById("canvasGrid");
var leftButtonDown = false;

var keys = {};

var ctx = canvas.getContext("2d");
var color = "000000";
var colorPicker = $('.colorpickerplus-embed .colorpickerplus-container');
colorPicker.colorpickerembed();
colorPicker.on('changeColor', function(e, col){
    color = col.substring(1, 7);
});


var socket = io.connect('http://noli.space:4201/pixon'); // TIP: io() with no args does auto-discovery
resizeCanvas();

//Loading message
ctx.fillStyle = "rgb(255,255,255)";
ctx.fillRect(0,0,conf.gridSize*conf.gridWidth,conf.gridSize*conf.gridHeight);
ctx.fillStyle = "rgb(0,0,0)";
ctx.textAlign = "center";
ctx.font = "100px Arial";
ctx.fillText("Loading...",(conf.gridSize*conf.gridWidth)/2,(conf.gridSize*conf.gridHeight)/2);

document.getElementById("body").addEventListener("dragover", function(e){e.preventDefault();}, true);
document.getElementById("body").addEventListener("drop", function(e){
	e.preventDefault();
	var loadingImage = loadImage(
        e.dataTransfer.files[0],
        function (img) {
            var imgCtx = img.getContext("2d");
            var pixArray = [];
            for (var i=0; i<conf.gridHeight; i++){
                for (var j=0; j<conf.gridWidth; j++){
                    var imageData = imgCtx.getImageData(i, j, 1, 1);
                    var p = {
                        x: i,
                        y: j,
                        r: imageData.data[0],
                        g: imageData.data[1],
                        b: imageData.data[2],
                        channel: 0
                    };
                    pixArray.push(p);
                }
            }
            socket.emit('pixels', pixArray);
        },
        {
            maxWidth: conf.gridWidth,
            maxHeight: conf.gridHeight,
            canvas: true
        }
    );
    if (!loadingImage) {
        // Alternative code ...
    }
}, true);
    
$(document).keydown(function (e) {
    //e.preventDefault();
    keys[e.which] = true;
    console.log(e.which);

    //Zoom shortcut
    if(e.which == 109){
        if (conf.gridSize > 1){
            conf.gridSize -= 1;
        }
        $("#inpGridSize").val(conf.gridSize);
        resizeCanvas();
    }else if(e.which == 107){
        conf.gridSize += 1;
        $("#inpGridSize").val(conf.gridSize);
        resizeCanvas();
    }

    //FillRect tool
    if(e.which == 49){
        savedPos[0] = [mousePos[0], mousePos[1]];
    }else if(e.which == 50){
        savedPos[1] = [mousePos[0], mousePos[1]];
    }else if(e.which == 51){
        console.log(savedPos);
        if (savedPos[0] && savedPos[1]){
            if (savedPos[0][0] >= 0 && savedPos[0][0] < conf.gridWidth
                && savedPos[0][1] >= 0 && savedPos[0][1] < conf.gridHeight
                && savedPos[1][0] >= 0 && savedPos[1][0] < conf.gridWidth
                && savedPos[1][1] >= 0 && savedPos[1][1] < conf.gridHeight){
                fillRect2(savedPos[0][0], savedPos[0][1], savedPos[1][0], savedPos[1][1], "#"+color);
            }
        }
        
        savedPos = [[-1,-1], [-1,-1]];
    }
});

$(document).keyup(function (e) {
    e.preventDefault();

    /*if (keys[49] && keys[50]) {
        
    }*/
    
    delete keys[e.which];
});


function mouseClick(e){
    e.preventDefault();
    leftButtonDown = true;
    if (e.which === 2 || keys[16] || keys[18]){
        var x = Math.floor((e.pageX - canvas.offsetLeft)/conf.gridSize),
            y = Math.floor((e.pageY - canvas.offsetTop)/conf.gridSize);
        pickColor(x,y);
    }else if(e.which === 1){ 
        clickEvent(e);
    }
}
$("#canvas").mousedown(mouseClick);
$("#canvasGrid").mousedown(mouseClick);

$(document).mouseup(function(e){
    //e.preventDefault();
    leftButtonDown = false;
});


function mouseMove(e) {
    e.preventDefault();
    var x = Math.floor((e.pageX - canvas.offsetLeft)/conf.gridSize),
        y = Math.floor((e.pageY - canvas.offsetTop)/conf.gridSize);

    mousePos = [x,y];
    $("#spanPosition").text("Mouse pos : ["+x+","+y+"]");
    if (leftButtonDown == true){
        clickEvent(e);
    }
}

$("#canvas").on("mousemove", mouseMove);
$("#canvasGrid").on("mousemove", mouseMove);


function fillRect(x,y,w,h,colorHex="#ffffff"){
    let pixs = [];
    for (var i = 0; i < w; i++) {
        for (var j = 0; j < h; j++) {
            pixs.push(pixel(0, colorHex.substr(1), x+i, y+j));
        }
    }
    socket.emit('pixels', pixs);
}

function fillRect2(x1, y1, x2, y2, colorHex="#ffffff"){
    let pixs = [];
    if (x1 > x2){
        let temp = x1;
        x1 = x2;
        x2 = temp;
    }
    if (y1 > y2){
        let temp = y1;
        y1 = y2;
        y2 = temp;
    }
    for (var i = x1; i <= x2; i++) {
        for (var j = y1; j <= y2; j++) {
            pixs.push(pixel(0, colorHex.substr(1), i, j));
        }
    }
    socket.emit('pixels', pixs);
}

function clear(colorHex="#ffffff"){
    let pixs = [];
    for (var i = 0; i < conf.gridWidth; i++) {
        for (var j = 0; j < conf.gridHeight; j++) {
            pixs.push(pixel(0, colorHex.substr(1), i, j));
        }
    }
    socket.emit('pixels', pixs);
}


function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}

function rgbToHex(r, g, b) {
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}


function pickColor(x,y){
    color = rgbToHex(pixelMap[0][x][y].r, pixelMap[0][x][y].g, pixelMap[0][x][y].b).substr(1);
    $(".colorpicker-element")[0].value = "#"+color;
}

function clickEvent(event){
    if (leftButtonDown == true && drawingEnabled){
        var x = Math.floor((event.pageX - canvas.offsetLeft)/conf.gridSize),
            y = Math.floor((event.pageY - canvas.offsetTop)/conf.gridSize);
        
        if ( 0 <= x < conf.gridWidth && 0 <= y < conf.gridHeight){
            if (lastPosAndColor.x != x || lastPosAndColor.y != y || lastPosAndColor.color != color){
                lastPosAndColor.x = x;
                lastPosAndColor.y = y;
                lastPosAndColor.color = color;
                var pix = pixel(channel, color, x, y);
                socket.emit('pixel', pix);
            }
        }
    }
}

window.addEventListener('wheel', function(e) {
    if (keys[17]){
        e.preventDefault();
        if (e.deltaY < 0) {
            conf.gridSize += 1;
            $("#inpGridSize").val(conf.gridSize);
            resizeCanvas();
        }
        if (e.deltaY > 0) {
            if (conf.gridSize > 1){
                conf.gridSize -= 1;
            }
            $("#inpGridSize").val(conf.gridSize);
            resizeCanvas();
        }
    }
});

$("#sizeMinus").on("click", function(){
    if (conf.gridSize > 1){
        conf.gridSize -= 1;
    }
    $("#inpGridSize").val(conf.gridSize);
    resizeCanvas();
});

$("#sizePlus").on("click", function(){
    conf.gridSize += 1;
    $("#inpGridSize").val(conf.gridSize);
    resizeCanvas();
});

$("#hideGrid").on("click", function(){
    if ($("#canvasGrid").is(":visible")){
        $("#canvasGrid").hide();
    }else{
        $("#canvasGrid").show();
    }
});

$("#btnViewAtDate").on("click", function(){
    if ($("#viewAtDate").val() != ""){
        let hour = $("#viewAtTime").val() == "" ? "00:00" : $("#viewAtTime").val();
        var dateString = $("#viewAtDate").val()+" "+hour,
            dateTimeParts = dateString.split(' '),
            timeParts = dateTimeParts[1].split(':'),
            dateParts = dateTimeParts[0].split('-'),
            date;

        var date = new Date(dateParts[0], parseInt(dateParts[1], 10) - 1, dateParts[2], timeParts[0], timeParts[1]);
        socket.emit('getAllPixelsAt', date.getTime());
        drawingEnabled = false;
    }
});

$("#btnViewAtNow").on("click", function(){
    socket.emit('getAllPixels');
    drawingEnabled = true;
});

function resizeCanvas(){
    canvas.width = conf.gridSize*conf.gridWidth;
    canvas.height = conf.gridSize*conf.gridHeight;
    canvasGrid.width = conf.gridSize*conf.gridWidth;
    canvasGrid.height = conf.gridSize*conf.gridHeight;
    drawGrid();
    drawMap(pixelMap);
}

function drawGrid(){
    var context = canvasGrid.getContext("2d");
    context.strokeStyle = "#222";
    context.lineWidth = 0.2;
    for (var i=1; i<conf.gridWidth; i++){
        context.beginPath();
        context.moveTo(i*conf.gridSize,0);
        context.lineTo(i*conf.gridSize,conf.gridSize*conf.gridHeight);
        context.stroke();
    }
    for (var i=1; i<conf.gridHeight; i++){
        context.beginPath();
        context.moveTo(0,i*conf.gridSize);
        context.lineTo(conf.gridSize*conf.gridWidth, i*conf.gridSize);
        context.stroke();
    }
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

function fromHex(hex){
    return {
        r: parseInt(hex.substring(0,2),16),
        g: parseInt(hex.substring(2,4),16),
        b: parseInt(hex.substring(4,6),16),
        x: parseInt(hex.substring(6,8),16),
        y: parseInt(hex.substring(8,10),16)
    };
}

function getColor(pix){
    return parseInt(pix.r, 16).toString() + parseInt(pix.g, 16).toString() + parseInt(pix.b, 16).toString();
}

function drawPixel(pix){
    if (pix.channel == channel){
        ctx.fillStyle = "#" + toHex(pix);
        ctx.fillRect(pix.x*conf.gridSize, pix.y*conf.gridSize, conf.gridSize, conf.gridSize);
    }
    pixelMap[pix.channel][pix.x][pix.y] = pix;
}

function drawMap(map){
    for (var i=0; i<map[channel].length; i++){
        for (var j=0; j<map[channel][i].length; j++){
            drawPixel(map[channel][i][j]);
        }
    }
}

socket.on('init', function (data) {
    conf = data.conf;
    resizeCanvas();
});

socket.on('pixel', function (pix) {
    pixelMap[pix.channel][pix.x][pix.y] = pix;
    drawPixel(pix);
});

socket.on('pixels', function (pixs) {
    if (!initialized){
        initialized = true;
        drawingEnabled = true;
    }

    for (var i=0; i<pixs.length; i++){
        var pix = pixs[i];
        pixelMap[pix.channel][pix.x][pix.y] = pix;
        drawPixel(pix);
    }
});

socket.on('allPixelsAt', function (pixs) {
    initPixelMap();
    resizeCanvas();
    
    for (var i=0; i<pixs.length; i++){
        var pix = pixs[i];
        pixelMap[pix.channel][pix.x][pix.y] = pix;
        drawPixel(pix);
    }
});

socket.on('nbConnected', function(nb){
    $("#spanNbConnected").html(nb+" connected");
})