const port = 8888

const express = require('express')
const app = express()
const server = app.listen(port)
const io = require('socket.io').listen(server).of('/pixon')

console.log(port + ' is the magic port')

var config = {
  width: 128,
  height: 128,
}

const Canvas = require('canvas')
const Image = Canvas.Image

const cvs = new Canvas(config.width, config.height)
const ctx = cvs.getContext('2d')

let data = ctx.createImageData(config.width, config.height)
let buffer = new Uint32Array(data.data.buffer)


app.set('view engine', 'ejs')
app.use('/views', express.static(__dirname + '/views'))
app.get('/', function(req, res) { res.render('index') })

io.on('connection', (socket) => {
  console.log('new peer!')
  socket.emit('init', { config })

  // TODO(flupe): is this needed?
  socket.data = { login: "", userId: 0 }

  socket.emit('reload', { buffer: data.data.buffer })

  socket.on('reload', () => {
    socket.emit('reload', { buffer: data.data.buffer })
  })

  socket.on('upload', (input) => {
    let b = input.buffer
    console.log(b.buffer)
    let newbuf = b.buffer.slice(b.byteOffset, b.byteOffet + b.byteLength)
    buffer.set(new Uint32Array(b.buffer, b.byteOffset, b.byteLength / Uint32Array.BYTES_PER_ELEMENT))
    socket.broadcast.emit('reload', input)
  })

})

