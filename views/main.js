const WIDTH = 128
const HEIGHT = 128


const socket = io.connect('localhost:8888/pixon')


const image = {}

image.cvs = document.createElement('canvas')
image.ctx = image.cvs.getContext('2d')
image.cvs.width = WIDTH
image.cvs.height = HEIGHT

image.data = image.ctx.createImageData(WIDTH, HEIGHT)
image.buffer = new Uint32Array(image.data.data.buffer)


// TODO(flupe): get rid of the 2nd canvas
const viewport = {
  setCursor(type) {
    this.cvs.style.cursor = type
    this.cvs.style.cursor = '-webkit-' + type
  },
  offset: { x: 0, y: 0 },
  flipX: 1,
  flipY: 1,
  scale: 3,
} 

viewport.cvs = document.createElement('canvas')
viewport.ctx = viewport.cvs.getContext('2d')
viewport.cvs.width = window.innerWidth
viewport.cvs.height = window.innerHeight

document.body.appendChild(viewport.cvs)


let activeColor = 0xffffffff

// drawing tools available

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

tool.pen = {
  init: () => {
    viewport.setCursor('crosshair')
  },
  mousemove: e => {
    let { cvs, offset, scale, flipX, flipY } = viewport
    let x = (e.pageX - cvs.width / 2 - offset.x) / scale * flipX + WIDTH / 2 | 0
    let y = (e.pageY - cvs.height / 2 - offset.y) / scale * flipY + HEIGHT / 2 | 0

    if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) {
      image.buffer[x + y * WIDTH] = activeColor
      updateImage()
    }
  },
  keydown: ({key}) => { if (key == 'Alt') switchTool(tool.translate) }
}

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


switchTool(tool.pen)

function updateViewport() {
  let { ctx, cvs, offset, scale, flipX, flipY } = viewport

  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, cvs.width, cvs.height)

  let left = cvs.width / 2 + offset.x - WIDTH * scale / 2
  let top = cvs.height / 2 + offset.y - HEIGHT * scale / 2
  let width = WIDTH * scale
  let height = WIDTH * scale

  ctx.save()
  ctx.translate(cvs.width / 2 + offset.x, cvs.height / 2 + offset.y)
  ctx.scale(scale * flipX, scale * flipY)
  ctx.translate(- WIDTH / 2 * flipX, - HEIGHT / 2 * flipY)

  ctx.imageSmoothingEnabled = false
  // TODO(flupe): maybe use directly putImageData
  ctx.drawImage(image.cvs, 0, 0, WIDTH * flipX, HEIGHT * flipY)

  ctx.restore()

  ctx.strokeStyle = '#fff'
  ctx.globalCompositeOperation = 'xor'
  ctx.strokeRect((left | 0) - .5, (top | 0) - .5, width + 1, height + 1)
  ctx.globalCompositeOperation = 'source-over'
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

const on = window.addEventListener.bind(window)

// TODO(flupe): see if using pointer events is more relevant (hint: it is)
on('mousemove', e => { tool.dispatch('mousemove', e) })
on('mousedown', e => { tool.dispatch('mousedown', e) })
on('mouseup', e => { tool.dispatch('mouseup', e) })

on('keydown', e => {
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

  else if (e.key == 'f') {
    viewport.flipX *= -1
    updateViewport()
  }

  else if (e.key == 'F') {
    viewport.flipY *= -1
    updateViewport()
  }

  else {
    tool.dispatch('keydown', e)
  }
})


on('keyup', e => { tool.dispatch('keyup', e) })


// input file handling

on('dragover', e => {
  e.preventDefault()
})

on('drop', e => {
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
      console.log(image.data.data.buffer)
      socket.emit('upload', { buffer: image.data.data.buffer })
    })

    img.src = e.target.result
  })

  reader.readAsDataURL(item.getAsFile())
})


on('resize', e => {
  viewport.cvs.width = window.innerWidth
  viewport.cvs.height = window.innerHeight
  updateViewport()
})

updateViewport()
