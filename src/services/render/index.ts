import type { LayoutConfig, SlotConfig, Shot, DecorationConfig } from '@/db/schema'
import type { TemplateConfig } from '@/db/schema'

export interface RenderJob {
  layout: LayoutConfig
  template: TemplateConfig
  shots: Shot[]
  decoration: DecorationConfig
  format: 'image/png' | 'image/jpeg'
  quality?: number
}

export interface RenderResult {
  blob: Blob
  width: number
  height: number
}

interface DecodedImage {
  source: CanvasImageSource
  width: number
  height: number
  close?: () => void
}

export async function renderStrip(job: RenderJob): Promise<RenderResult> {
  const { layout, template, shots, decoration, format, quality } = job

  const canvas = document.createElement('canvas')
  canvas.width = layout.canvas.width
  canvas.height = layout.canvas.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get 2D canvas context')

  // Draw background
  ctx.fillStyle = template.background
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Draw shots into slots
  for (let i = 0; i < layout.slots.length; i++) {
    const slot = layout.slots[i]
    const shot = shots[i]
    if (!shot) continue

    const img = await decodeImageBlob(shot.blob)

    // Apply filter
    if (decoration.filterId && decoration.filterId !== 'normal') {
      ctx.filter = getCanvasFilter(decoration.filterId)
    } else {
      ctx.filter = 'none'
    }

    drawImageCover(ctx, img, slot)
    img.close?.()
  }

  // Reset filter for overlays
  ctx.filter = 'none'

  // Draw frame color border
  if (decoration.frameColor) {
    drawFrameOverlay(ctx, layout, decoration.frameColor)
  }

  if (decoration.selectedStickerIds.length > 0) {
    drawStickers(ctx, canvas.width, canvas.height, decoration.selectedStickerIds)
  }

  // Draw date/time
  if (decoration.showDateTime) {
    drawDateTime(ctx, canvas.width, canvas.height, template)
  }

  // Draw logo text
  if (decoration.logoText) {
    drawLogoText(ctx, decoration.logoText, canvas.width, canvas.height, template)
  }

  // Export
  const blob = await canvasToBlob(
    canvas,
    format,
    quality ?? (format === 'image/jpeg' ? 0.9 : undefined),
  )

  return {
    blob,
    width: canvas.width,
    height: canvas.height,
  }
}

async function decodeImageBlob(blob: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob)

    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    }
  }

  const url = URL.createObjectURL(blob)

  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve({
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
      })
    }

    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to decode image blob'))
    }

    image.src = url
  })
}

type StickerShape = 'heart' | 'star' | 'burst' | 'flower' | 'bubble' | 'diamond'

function getStickerStyle(id: string, index: number): { color: string; shape: StickerShape } {
  const palette = ['#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#22c55e', '#3b82f6']

  if (id.includes('heart')) return { color: '#ef4444', shape: 'heart' }
  if (id.includes('star')) return { color: '#f59e0b', shape: 'star' }
  if (id.includes('speech')) return { color: '#8b5cf6', shape: 'bubble' }
  if (id.includes('flower')) return { color: '#ec4899', shape: 'flower' }
  if (id.includes('celebration')) return { color: '#22c55e', shape: 'burst' }
  if (id.includes('shapes')) return { color: '#3b82f6', shape: 'diamond' }

  return {
    color: palette[index % palette.length],
    shape: ['heart', 'star', 'bubble', 'flower', 'burst', 'diamond'][index % 6] as StickerShape,
  }
}

function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const half = size / 2
  ctx.beginPath()
  ctx.moveTo(x, y + half * 0.3)
  ctx.bezierCurveTo(x, y - half * 0.6, x - size, y - half * 0.1, x, y + size)
  ctx.bezierCurveTo(x + size, y - half * 0.1, x, y - half * 0.6, x, y + half * 0.3)
  ctx.closePath()
  ctx.fill()
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  const spikes = 5
  const innerRadius = radius * 0.45
  let rotation = (Math.PI / 2) * 3

  ctx.beginPath()
  ctx.moveTo(x, y - radius)

  for (let index = 0; index < spikes; index++) {
    ctx.lineTo(x + Math.cos(rotation) * radius, y + Math.sin(rotation) * radius)
    rotation += Math.PI / spikes
    ctx.lineTo(x + Math.cos(rotation) * innerRadius, y + Math.sin(rotation) * innerRadius)
    rotation += Math.PI / spikes
  }

  ctx.closePath()
  ctx.fill()
}

function drawBurst(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.beginPath()
  for (let index = 0; index < 10; index++) {
    const angle = (Math.PI * 2 * index) / 10
    const pointRadius = index % 2 === 0 ? radius : radius * 0.55
    const px = x + Math.cos(angle) * pointRadius
    const py = y + Math.sin(angle) * pointRadius
    if (index === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fill()
}

function drawFlower(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  for (let index = 0; index < 6; index++) {
    const angle = (Math.PI * 2 * index) / 6
    const px = x + Math.cos(angle) * radius * 0.75
    const py = y + Math.sin(angle) * radius * 0.75
    ctx.beginPath()
    ctx.arc(px, py, radius * 0.45, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.beginPath()
  ctx.arc(x, y, radius * 0.35, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
}

function drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.beginPath()
  roundRect(ctx, x - radius, y - radius * 0.72, radius * 2, radius * 1.45, radius * 0.35)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(x - radius * 0.2, y + radius * 0.7)
  ctx.lineTo(x - radius * 0.55, y + radius * 1.15)
  ctx.lineTo(x + radius * 0.05, y + radius * 0.82)
  ctx.closePath()
  ctx.fill()
}

function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.beginPath()
  ctx.moveTo(x, y - radius)
  ctx.lineTo(x + radius, y)
  ctx.lineTo(x, y + radius)
  ctx.lineTo(x - radius, y)
  ctx.closePath()
  ctx.fill()
}

function drawStickers(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  stickerIds: string[],
) {
  const positions = [
    { x: canvasWidth * 0.18, y: canvasHeight * 0.14 },
    { x: canvasWidth * 0.82, y: canvasHeight * 0.18 },
    { x: canvasWidth * 0.2, y: canvasHeight * 0.82 },
    { x: canvasWidth * 0.84, y: canvasHeight * 0.72 },
    { x: canvasWidth * 0.5, y: canvasHeight * 0.1 },
  ]

  stickerIds.slice(0, 5).forEach((stickerId, index) => {
    const { color, shape } = getStickerStyle(stickerId, index)
    const { x, y } = positions[index]
    const size = Math.max(36, Math.min(canvasWidth, canvasHeight) * 0.04)

    ctx.save()
    ctx.globalAlpha = 0.92
    ctx.fillStyle = color
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = size * 0.16
    ctx.lineJoin = 'round'

    if (shape === 'heart') drawHeart(ctx, x, y, size * 0.55)
    if (shape === 'star') drawStar(ctx, x, y, size * 0.75)
    if (shape === 'burst') drawBurst(ctx, x, y, size * 0.8)
    if (shape === 'bubble') drawBubble(ctx, x, y, size * 0.8)
    if (shape === 'diamond') drawDiamond(ctx, x, y, size * 0.72)
    if (shape === 'flower') {
      ctx.fillStyle = color
      drawFlower(ctx, x, y, size * 0.68)
      ctx.restore()
      return
    }

    ctx.stroke()
    ctx.restore()
  })
}

function drawImageCover(ctx: CanvasRenderingContext2D, img: DecodedImage, slot: SlotConfig) {
  const { x, y, width, height, radius } = slot

  // Calculate cover fit
  const imgRatio = img.width / img.height
  const slotRatio = width / height

  let sx = 0,
    sy = 0,
    sw = img.width,
    sh = img.height

  if (imgRatio > slotRatio) {
    sw = img.height * slotRatio
    sx = (img.width - sw) / 2
  } else {
    sh = img.width / slotRatio
    sy = (img.height - sh) / 2
  }

  ctx.save()
  roundRect(ctx, x, y, width, height, radius)
  ctx.clip()
  ctx.drawImage(img.source, sx, sy, sw, sh, x, y, width, height)
  ctx.restore()
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function getCanvasFilter(filterId: string): string {
  const filterMap: Record<string, string> = {
    bw: 'grayscale(100%)',
    warm: 'sepia(30%) saturate(140%) brightness(105%)',
    cool: 'saturate(80%) hue-rotate(10deg) brightness(105%)',
    vintage: 'sepia(40%) contrast(90%) brightness(95%) saturate(80%)',
    fade: 'contrast(85%) brightness(110%) saturate(80%)',
    film: 'contrast(110%) saturate(85%) brightness(95%) sepia(10%)',
    rosy: 'sepia(15%) saturate(130%) brightness(105%) hue-rotate(-10deg)',
  }
  return filterMap[filterId] ?? 'none'
}

function drawFrameOverlay(ctx: CanvasRenderingContext2D, layout: LayoutConfig, color: string) {
  const margin = 8
  ctx.strokeStyle = color
  ctx.lineWidth = margin
  ctx.strokeRect(
    margin / 2,
    margin / 2,
    layout.canvas.width - margin,
    layout.canvas.height - margin,
  )
}

function drawDateTime(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  template: TemplateConfig,
) {
  const now = new Date()
  const text = now.toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  ctx.save()
  ctx.fillStyle = template.background === '#212121' ? '#e0e0e0' : '#333333'
  ctx.font = `${template.label.fontSize * 0.6}px Poppins, sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText(text, canvasWidth / 2, canvasHeight - 40)
  ctx.restore()
}

function drawLogoText(
  ctx: CanvasRenderingContext2D,
  text: string,
  canvasWidth: number,
  canvasHeight: number,
  template: TemplateConfig,
) {
  ctx.save()
  ctx.fillStyle = template.background === '#212121' ? '#e0e0e0' : '#333333'
  ctx.font = `700 ${template.label.fontSize * 0.7}px Poppins, sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText(text, canvasWidth / 2, canvasHeight - 20)
  ctx.restore()
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Canvas export failed'))
      },
      type,
      quality,
    )
  })
}
