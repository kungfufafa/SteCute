import { decodePng, encodeRgbaPng } from '../png'

type SoftwareBitmap = {
  width: number
  height: number
  data: Uint8ClampedArray
  close: () => void
}

type PathPoint = { x: number; y: number }

class SoftwareCanvas {
  #width = 0
  #height = 0
  pixels = new Uint8ClampedArray(0)

  get width() {
    return this.#width
  }

  set width(value: number) {
    this.#width = Math.max(0, value)
    this.realloc()
  }

  get height() {
    return this.#height
  }

  set height(value: number) {
    this.#height = Math.max(0, value)
    this.realloc()
  }

  getContext(type: string) {
    if (type !== '2d') return null
    return new SoftwareContext(this)
  }

  toBlob(callback: (blob: Blob | null) => void, type = 'image/png') {
    const png = encodeRgbaPng(this.#width, this.#height, this.pixels)
    callback(new Blob([png], { type }))
  }

  private realloc() {
    this.pixels = new Uint8ClampedArray(this.#width * this.#height * 4)
  }
}

class SoftwareContext {
  fillStyle = '#000000'
  strokeStyle = '#000000'
  globalAlpha = 1
  filter = 'none'
  font = '16px sans-serif'
  textAlign = 'start'
  lineWidth = 1
  lineJoin = 'miter'
  imageSmoothingEnabled = true
  imageSmoothingQuality = 'low'
  canvas: SoftwareCanvas
  private path: PathPoint[] = []
  private clipRect: { x: number; y: number; width: number; height: number } | null = null
  private stack: Array<{
    fillStyle: string
    globalAlpha: number
    filter: string
    clipRect: { x: number; y: number; width: number; height: number } | null
  }> = []

  constructor(canvas: SoftwareCanvas) {
    this.canvas = canvas
  }

  save() {
    this.stack.push({
      fillStyle: this.fillStyle,
      globalAlpha: this.globalAlpha,
      filter: this.filter,
      clipRect: this.clipRect ? { ...this.clipRect } : null,
    })
  }

  restore() {
    const frame = this.stack.pop()
    if (!frame) return
    this.fillStyle = frame.fillStyle
    this.globalAlpha = frame.globalAlpha
    this.filter = frame.filter
    this.clipRect = frame.clipRect
  }

  beginPath() {
    this.path = []
  }

  moveTo(x: number, y: number) {
    this.path.push({ x, y })
  }

  lineTo(x: number, y: number) {
    this.path.push({ x, y })
  }

  quadraticCurveTo(_cpx: number, _cpy: number, x: number, y: number) {
    this.path.push({ x, y })
  }

  bezierCurveTo(_cp1x: number, _cp1y: number, _cp2x: number, _cp2y: number, x: number, y: number) {
    this.path.push({ x, y })
  }

  closePath() {}

  clip() {
    if (this.path.length === 0) return
    const xs = this.path.map((point) => point.x)
    const ys = this.path.map((point) => point.y)
    const x = Math.min(...xs)
    const y = Math.min(...ys)
    this.clipRect = {
      x,
      y,
      width: Math.max(0, Math.max(...xs) - x),
      height: Math.max(0, Math.max(...ys) - y),
    }
  }

  fill() {}

  stroke() {}

  fillText() {}

  translate() {}

  scale() {}

  rotate() {}

  setTransform() {}

  resetTransform() {}

  arc() {}

  ellipse() {}

  fillRect(x: number, y: number, width: number, height: number) {
    const color = parseColor(String(this.fillStyle))
    const alpha = this.globalAlpha
    const left = Math.max(0, Math.floor(x))
    const top = Math.max(0, Math.floor(y))
    const right = Math.min(this.canvas.width, Math.ceil(x + width))
    const bottom = Math.min(this.canvas.height, Math.ceil(y + height))

    for (let py = top; py < bottom; py++) {
      for (let px = left; px < right; px++) {
        if (!insideClip(px, py, this.clipRect)) continue
        const offset = (py * this.canvas.width + px) * 4
        this.canvas.pixels[offset] = mix(this.canvas.pixels[offset], color[0], alpha)
        this.canvas.pixels[offset + 1] = mix(this.canvas.pixels[offset + 1], color[1], alpha)
        this.canvas.pixels[offset + 2] = mix(this.canvas.pixels[offset + 2], color[2], alpha)
        this.canvas.pixels[offset + 3] = 255
      }
    }
  }

  drawImage(
    source: SoftwareBitmap | { width: number; height: number; data?: Uint8ClampedArray },
    sx: number,
    sy?: number,
    sw?: number,
    sh?: number,
    dx?: number,
    dy?: number,
    dw?: number,
    dh?: number,
  ) {
    const bitmap = toBitmap(source)
    if (!bitmap) return

    let sourceX = 0
    let sourceY = 0
    let sourceW = bitmap.width
    let sourceH = bitmap.height
    let destX = sx
    let destY = sy ?? 0
    let destW = sw ?? bitmap.width
    let destH = sh ?? bitmap.height

    if (arguments.length === 9) {
      sourceX = sx
      sourceY = sy ?? 0
      sourceW = sw ?? bitmap.width
      sourceH = sh ?? bitmap.height
      destX = dx ?? 0
      destY = dy ?? 0
      destW = dw ?? sourceW
      destH = dh ?? sourceH
    }

    for (let y = 0; y < destH; y++) {
      const destPy = Math.floor(destY + y)
      if (destPy < 0 || destPy >= this.canvas.height) continue
      const srcPy = Math.min(
        bitmap.height - 1,
        Math.max(0, Math.floor(sourceY + ((y + 0.5) * sourceH) / destH)),
      )

      for (let x = 0; x < destW; x++) {
        const destPx = Math.floor(destX + x)
        if (destPx < 0 || destPx >= this.canvas.width) continue
        if (!insideClip(destPx, destPy, this.clipRect)) continue
        const srcPx = Math.min(
          bitmap.width - 1,
          Math.max(0, Math.floor(sourceX + ((x + 0.5) * sourceW) / destW)),
        )
        const si = (srcPy * bitmap.width + srcPx) * 4
        const di = (destPy * this.canvas.width + destPx) * 4
        const filtered = applyCssFilter(
          bitmap.data[si],
          bitmap.data[si + 1],
          bitmap.data[si + 2],
          this.filter,
        )
        this.canvas.pixels[di] = filtered[0]
        this.canvas.pixels[di + 1] = filtered[1]
        this.canvas.pixels[di + 2] = filtered[2]
        this.canvas.pixels[di + 3] = bitmap.data[si + 3]
      }
    }
  }
}

function toBitmap(
  source: SoftwareBitmap | { width: number; height: number; data?: Uint8ClampedArray },
): SoftwareBitmap | null {
  if ('data' in source && source.data) {
    return {
      width: source.width,
      height: source.height,
      data: source.data,
      close() {},
    }
  }

  return null
}

function insideClip(
  x: number,
  y: number,
  clip: { x: number; y: number; width: number; height: number } | null,
) {
  if (!clip) return true
  return x >= clip.x && y >= clip.y && x < clip.x + clip.width && y < clip.y + clip.height
}

function mix(current: number, next: number, alpha: number) {
  return Math.round(current * (1 - alpha) + next * alpha)
}

function clampByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function parseFilterAmount(raw: string, fallback = 1) {
  const trimmed = raw.trim()
  if (!trimmed) return fallback
  if (trimmed.endsWith('%')) {
    const parsed = Number.parseFloat(trimmed.slice(0, -1))
    return Number.isFinite(parsed) ? parsed / 100 : fallback
  }
  const parsed = Number.parseFloat(trimmed)
  return Number.isFinite(parsed) ? parsed : fallback
}

function applyCssFilter(
  red: number,
  green: number,
  blue: number,
  filter: string,
): [number, number, number] {
  if (!filter || filter === 'none') return [red, green, blue]

  const tokens = filter.match(/[a-z-]+\([^)]*\)/gi) ?? []
  let nextRed = red
  let nextGreen = green
  let nextBlue = blue

  for (const token of tokens) {
    const name = token.slice(0, token.indexOf('(')).toLowerCase()
    const raw = token.slice(token.indexOf('(') + 1, token.lastIndexOf(')'))

    if (name === 'grayscale') {
      const amount = Math.max(0, Math.min(1, parseFilterAmount(raw)))
      const luma = 0.2126 * nextRed + 0.7152 * nextGreen + 0.0722 * nextBlue
      nextRed += (luma - nextRed) * amount
      nextGreen += (luma - nextGreen) * amount
      nextBlue += (luma - nextBlue) * amount
      continue
    }

    if (name === 'sepia') {
      const amount = Math.max(0, Math.min(1, parseFilterAmount(raw)))
      const sepiaRed = 0.393 * nextRed + 0.769 * nextGreen + 0.189 * nextBlue
      const sepiaGreen = 0.349 * nextRed + 0.686 * nextGreen + 0.168 * nextBlue
      const sepiaBlue = 0.272 * nextRed + 0.534 * nextGreen + 0.131 * nextBlue
      nextRed += (sepiaRed - nextRed) * amount
      nextGreen += (sepiaGreen - nextGreen) * amount
      nextBlue += (sepiaBlue - nextBlue) * amount
      continue
    }

    if (name === 'saturate') {
      const amount = Math.max(0, parseFilterAmount(raw))
      const luma = 0.2126 * nextRed + 0.7152 * nextGreen + 0.0722 * nextBlue
      nextRed = luma + (nextRed - luma) * amount
      nextGreen = luma + (nextGreen - luma) * amount
      nextBlue = luma + (nextBlue - luma) * amount
      continue
    }

    if (name === 'brightness') {
      const amount = Math.max(0, parseFilterAmount(raw))
      nextRed *= amount
      nextGreen *= amount
      nextBlue *= amount
      continue
    }

    if (name === 'contrast') {
      const amount = Math.max(0, parseFilterAmount(raw))
      nextRed = (nextRed - 128) * amount + 128
      nextGreen = (nextGreen - 128) * amount + 128
      nextBlue = (nextBlue - 128) * amount + 128
    }
  }

  return [clampByte(nextRed), clampByte(nextGreen), clampByte(nextBlue)]
}

function parseColor(input: string): [number, number, number, number] {
  const hex = input.trim()
  if (hex.startsWith('#') && hex.length === 7) {
    return [
      Number.parseInt(hex.slice(1, 3), 16),
      Number.parseInt(hex.slice(3, 5), 16),
      Number.parseInt(hex.slice(5, 7), 16),
      255,
    ]
  }

  return [0, 0, 0, 255]
}

export function installSoftwareCanvas() {
  const createElement = (tag: string) => {
    if (tag.toLowerCase() === 'canvas') return new SoftwareCanvas()
    throw new Error(`Unsupported element: ${tag}`)
  }

  Object.assign(globalThis, {
    document: { createElement },
    window: globalThis,
    createImageBitmap: async (blob: Blob) => {
      const decoded = decodePng(new Uint8Array(await blob.arrayBuffer()))
      return {
        width: decoded.width,
        height: decoded.height,
        data: decoded.data,
        close() {},
      }
    },
  })
}
