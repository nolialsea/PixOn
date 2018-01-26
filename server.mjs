'use strict'

import PixelCanvas from './src/canvas'
import Canvas from 'canvas'
import express from 'express'
import path from 'path'
import socketio from 'socket.io'

const port = 8888
const app = express()
const server = app.listen(port)
const io = socketio.listen(server)

const config = {
  width: 128,
  height: 128,
}

const Image = Canvas.Image
const image = new PixelCanvas(new Canvas, config.width, config.height)

app.set('view engine', 'ejs')
app.use('/dist', express.static('dist'))
app.get('/', (req, res) => { res.render('index') })

io.on('connection', socket => {
  socket.emit('init', { config })
  socket.emit('reload', { buffer: image.buffer })

  socket.on('reload', _ => socket.emit('reload', { buffer: image.buffer }))

  // TODO(flupe): time validation

  socket.on('upload', input => {
    let buf8 = new Uint8Array(image.buffer)
    buf8.set(input.buffer)
    socket.broadcast.emit('reload', input)
  })

  socket.on('pixel', input => {
    let { x, y, color } = input
    image.pixel(x, y, color)
    socket.broadcast.emit('pixel', input)
  })

  socket.on('rect', input => {
    let { x, y, width, height, color } = input
    image.rect(x, y, width, height, color)
    socket.broadcast.emit('rect', input)
  })
})

