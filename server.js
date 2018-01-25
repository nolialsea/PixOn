const port = 8888

const express = require('express')
const path = require('path')
const app = express()
const server = app.listen(port)
const io = require('socket.io').listen(server)

const config = {
  width: 128,
  height: 128,
}

const Canvas = require('canvas')
const Image = Canvas.Image

const cvs = new Canvas(config.width, config.height)
const ctx = cvs.getContext('2d')

const image = {}

image.data = ctx.createImageData(config.width, config.height)
image.buffer = image.data.data.buffer
image.buf32 = new Uint32Array(image.buffer)

app.set('view engine', 'ejs')
app.use('/dist', express.static(__dirname + '/dist'))
app.get('/', (req, res) => { res.render('index') })

io.on('connection', socket => {
  socket.emit('init', { config })
  socket.emit('reload', { buffer: image.buffer })

  socket.on('reload', _ => socket.emit('reload', { buffer: image.buffer }))

  // TODO(flupe): time validation
  // TODO(flupe): sever copy of current state
  socket.on('upload', input => socket.broadcast.emit('reload', input))
  socket.on('pixel', input => socket.broadcast.emit('pixel', input))
  socket.on('rect', input => socket.broadcast.emit('rect', input))
})

