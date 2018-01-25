const { round } = Math
const on = (target, ...args) => target.addEventListener(...args)

const WIDTH = 128
const HEIGHT = 128

const socket = io.connect('ws://localhost:8888')
const pointer = { x: 0, y: 0, down: false }


const image = {}
image.cvs = document.createElement('canvas')
image.ctx = image.cvs.getContext('2d')
image.cvs.width = WIDTH
image.cvs.height = HEIGHT

image.data = image.ctx.createImageData(WIDTH, HEIGHT)
image.buffer = new Uint32Array(image.data.data.buffer)


const viewport = {
  setCursor(type) {
    this.cvs.style.cursor = type
    this.cvs.style.cursor = '-webkit-' + type
  },
  offset: { x: 0, y: 0 },
  flip: { x: 1, y: 1 },
  scale: 3,
}
viewport.cvs = document.createElement('canvas')
viewport.ctx = viewport.cvs.getContext('2d')
viewport.cvs.width = window.innerWidth
viewport.cvs.height = window.innerHeight

document.body.appendChild(viewport.cvs)


// TODO(flupe): palette manager
let activeColor = 0xffffffff


const tool = {}
let current = null

tool.dispatch = (method, ...args) => {
  if (current && current[method]) {
    current[method].apply(current, args)
  }
}

function switchTool(next) {
  let previous = current
  current = next
  tool.dispatch('init', previous)
}

// TODO(flupe): remove drawing operations duplication
tool.pen = {
  init: _ => viewport.setCursor('crosshair'),
  mousemove: e => {
    if (!pointer.down) return
    let { cvs, offset, flip, scale } = viewport
    let x = round((e.pageX - cvs.width / 2 - offset.x) / scale * flip.x + WIDTH / 2)
    let y = round((e.pageY - cvs.height / 2 - offset.y) / scale * flip.y + HEIGHT / 2)

    if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) {
      let offset = x + y * WIDTH
      image.buffer[offset] = activeColor
      socket.emit('pixel', { offset, color: activeColor })
      updateImage()
    }
  },
  keydown: ({key}) => { if (key == 'Alt') switchTool(tool.translate) }
}

// TODO(flupe): remove this as a tool
//              and rather make it a tool `modifier`
tool.translate = {
  origin: { x: 0, y: 0 },
  moving: false,
  previous: null,
  init: function(previous) {
    viewport.setCursor('grab')
    this.previous = previous
  },
  mousedown: function({ pageX, pageY }) {
    viewport.setCursor('grabbing')
    this.moving = true
    this.origin.x = pageX
    this.origin.y = pageY
  },
  mouseup: function() {
    viewport.setCursor('grab')
    this.moving = false
  },
  mousemove: function({ pageX, pageY }) {
    if (!this.moving) return
    viewport.offset.x += pageX - this.origin.x
    viewport.offset.y += pageY - this.origin.y
    this.origin.x = pageX
    this.origin.y = pageY
    updateViewport()
  },
  keyup: function({ key }) {
    if (key == 'Alt') {
      switchTool(this.previous)
    }
  }
}

// TODO(flupe): GUI
tool.rectangle = {
  init: _ => viewport.setCursor('crosshair'),
  origin: { x: 0, y: 0 },
  drawing: false,
  mousedown: function(e) {
    this.drawing = true
    this.origin.x = pointer.x
    this.origin.y = pointer.y
  },
  mouseup: function(e) {
    if (!this.drawing) return
    this.drawing = false

    let x = this.origin.x
    let y = this.origin.y
    let width = pointer.x - x
    let height = pointer.y - y

    // TODO(flupe): synchronize cvs & its associated imagedata
    //              + benchmark the hell out of it (don't)
    image.ctx.fillStyle = '#fff'
    image.ctx.fillRect(x, y, width, height)
    socket.emit('rect', { x, y, width, height })
    updateViewport()
  }
}


switchTool(tool.pen)

function updateViewport() {
  let { ctx, cvs, offset, flip, scale } = viewport

  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, cvs.width, cvs.height)

  ctx.save()
  ctx.translate(cvs.width / 2 + offset.x, cvs.height / 2 + offset.y)
  ctx.scale(scale * flip.x, scale * flip.y)
  ctx.translate(- WIDTH / 2 * flip.x, - HEIGHT / 2 * flip.y)

  ctx.imageSmoothingEnabled = false
  ctx.drawImage(image.cvs, 0, 0, WIDTH * flip.x, HEIGHT * flip.y)

  ctx.restore()
}

function updateImage() {
  let { ctx, data } = image
  ctx.putImageData(data, 0, 0)
  updateViewport()
}


socket.on('reload', ({ buffer }) => {
  image.buffer.set(new Uint32Array(buffer))
  updateImage()
})

socket.on('pixel', ({ offset, color }) => {
  image.buffer[offset] = color
  updateImage()
})

socket.on('rect', ({ x, y, width, height }) => {
  image.ctx.fillStyle = '#fff'
  image.ctx.fillRect(x, y, width, height)
  updateViewport()
})


function updatePointer(e) {
  let { cvs, offset, flip, scale } = viewport
  pointer.x = round((e.pageX - cvs.width / 2 - offset.x) / scale * flip.x + WIDTH / 2)
  pointer.y = round((e.pageY - cvs.height / 2 - offset.y) / scale * flip.y + HEIGHT / 2)
}

// TODO(flupe): see if using pointer events is more relevant (hint: it is)
on(window, 'mousemove', e => {
  updatePointer(e)
  tool.dispatch('mousemove', e)
})

on(window, 'mousedown', e => {
  pointer.down = true
  updatePointer(e)
  tool.dispatch('mousedown', e)
})

on(window, 'mouseup', e => {
  pointer.down = false
  updatePointer(e)
  tool.dispatch('mouseup', e)
})

on(window, 'keydown', e => {
  // scale shortcuts
  if (e.key == '+' && e.ctrlKey) {
    e.preventDefault()
    viewport.scale += 1
    updateViewport()
  }

  else if (e.key == '-' && e.ctrlKey) {
    e.preventDefault()
    viewport.scale = Math.max(viewport.scale - 1, 1)
    updateViewport()
  }

  else if (e.key == 'r') {
    switchTool(tool.rectangle)
  }

  else if (e.key == 'b') {
    switchTool(tool.pen)
  }

  else if (e.key == 'f') {
    viewport.flip.x *= -1
    updateViewport()
  }

  else if (e.key == 'F') {
    viewport.flip.y *= -1
    updateViewport()
  }

  else {
    tool.dispatch('keydown', e)
  }
})


on(window, 'keyup', e => tool.dispatch('keyup', e))


// input file handling

on(window, 'dragover', e => e.preventDefault())

on(window, 'drop', e => {
  e.preventDefault()

  let dt = e.dataTransfer
  let item = dt.items ? dt.items[0] : dt.files[0]

  if (!item.type.startsWith('image/')) return

  let reader = new FileReader()

  reader.addEventListener('load', e => {
    let img = new Image()

    img.addEventListener('load', () => {
      let { ctx } = image

      ctx.imageSmoothingEnabled = false
      ctx.drawImage(img, 0, 0, WIDTH, HEIGHT)
      image.data = ctx.getImageData(0, 0, WIDTH, HEIGHT)
      image.buffer = new Uint32Array(image.data.data.buffer)

      updateViewport()
      socket.emit('upload', { buffer: image.buffer.buffer })
    })

    img.src = e.target.result
  })

  reader.readAsDataURL(item.getAsFile())
})


on(window, 'resize', e => {
  viewport.cvs.width = window.innerWidth
  viewport.cvs.height = window.innerHeight
  updateViewport()
})

updateViewport()
