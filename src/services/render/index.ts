import type { LayoutConfig, SlotConfig, Shot, DecorationConfig } from '@/db/schema'
import type { TemplateConfig } from '@/db/schema'
import { resolveTemplateLayout } from '@/templates'

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
  const renderLayout = resolveTemplateLayout(layout, template)

  const canvas = document.createElement('canvas')
  canvas.width = renderLayout.canvas.width
  canvas.height = renderLayout.canvas.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get 2D canvas context')

  await drawTemplateBackground(ctx, canvas.width, canvas.height, template)

  const frameColor = decoration.frameColor || template.defaultFrameColor

  // Draw shots into slots
  for (let i = 0; i < renderLayout.slots.length; i++) {
    const slot = renderLayout.slots[i]
    const shot = shots[i]
    if (!shot) continue

    const img = await decodeImageBlob(shot.blob)

    drawPhotoBacking(ctx, slot, frameColor, template)

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

  if (decoration.selectedStickerIds.length > 0) {
    drawStickers(ctx, canvas.width, canvas.height, decoration.selectedStickerIds)
  }

  await drawTemplateOverlay(ctx, canvas.width, canvas.height, template)
  await drawTemplateLabel(ctx, canvas.width, canvas.height, template, renderLayout)

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

async function drawTemplateBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  template: TemplateConfig,
) {
  ctx.fillStyle = template.background
  ctx.fillRect(0, 0, width, height)

  if (
    template.blanko.mode === 'image' &&
    template.blanko.imageLayer === 'background' &&
    template.blanko.backgroundImage
  ) {
    await tryDrawBlankoImage(ctx, width, height, template)
    return
  }

  ctx.save()

  if (template.id === 'classic') {
    ctx.restore()
    return
  }

  if (template.blanko.pattern === 'gingham') drawGinghamBackground(ctx, width, height, template)
  if (template.blanko.pattern === 'mono') drawMonoBackground(ctx, width, height)
  if (template.blanko.pattern === 'paper') drawPaperBackground(ctx, width, height, template)

  ctx.restore()
}

async function drawTemplateOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  template: TemplateConfig,
) {
  if (
    template.blanko.mode !== 'image' ||
    template.blanko.imageLayer === 'background' ||
    !template.blanko.backgroundImage
  ) {
    return
  }

  await tryDrawBlankoImage(ctx, width, height, template)
}

async function tryDrawBlankoImage(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  template: TemplateConfig,
) {
  if (!template.blanko.backgroundImage) return

  try {
    await drawBlankoImage(
      ctx,
      width,
      height,
      template.blanko.backgroundImage,
      template.blanko.imageFit ?? 'cover',
    )
  } catch (error) {
    console.warn(`Falling back to generated blanko for template "${template.id}".`, error)
  }
}

async function drawBlankoImage(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  path: string,
  fit: 'cover' | 'contain' | 'stretch',
) {
  const response = await fetch(path)
  if (!response.ok) throw new Error(`Failed to load template blanko: ${path}`)
  const image = await decodeImageBlob(await response.blob())
  drawImageFit(ctx, image, { x: 0, y: 0, width, height, radius: 0 }, fit)
  image.close?.()
}

function drawImageFit(
  ctx: CanvasRenderingContext2D,
  img: DecodedImage,
  slot: SlotConfig,
  fit: 'cover' | 'contain' | 'stretch',
) {
  const { x, y, width, height } = slot

  if (fit === 'stretch') {
    ctx.drawImage(img.source, x, y, width, height)
    return
  }

  if (fit === 'contain') {
    const scale = Math.min(width / img.width, height / img.height)
    const drawWidth = img.width * scale
    const drawHeight = img.height * scale
    const drawX = x + (width - drawWidth) / 2
    const drawY = y + (height - drawHeight) / 2
    ctx.drawImage(img.source, drawX, drawY, drawWidth, drawHeight)
    return
  }

  drawImageCover(ctx, img, slot)
}

function drawPaperBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  template: TemplateConfig,
) {
  ctx.fillStyle = template.background
  ctx.fillRect(0, 0, width, height)

  ctx.globalAlpha = 0.16
  ctx.fillStyle = template.accentColor
  for (let y = 120; y < height; y += 160) {
    ctx.fillRect(0, y, width, 2)
  }

  ctx.globalAlpha = 0.08
  for (let index = 0; index < 80; index++) {
    const x = (index * 137) % width
    const y = (index * 193) % height
    ctx.fillRect(x, y, 2, 2)
  }
}

function drawGinghamBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  template: TemplateConfig,
) {
  const cell = 96
  ctx.fillStyle = '#fff7ed'
  ctx.fillRect(0, 0, width, height)

  ctx.globalAlpha = 0.18
  ctx.fillStyle = template.accentColor
  for (let x = 0; x < width; x += cell * 2) {
    ctx.fillRect(x, 0, cell, height)
  }
  for (let y = 0; y < height; y += cell * 2) {
    ctx.fillRect(0, y, width, cell)
  }

  ctx.globalAlpha = 0.08
  ctx.fillStyle = template.textColor
  for (let x = cell; x < width; x += cell * 2) {
    ctx.fillRect(x, 0, 1, height)
  }
  for (let y = cell; y < height; y += cell * 2) {
    ctx.fillRect(0, y, width, 1)
  }
}

function drawMonoBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.fillStyle = '#202020'
  ctx.fillRect(0, 0, width, height)

  ctx.globalAlpha = 0.1
  ctx.fillStyle = '#ffffff'
  for (let y = 80; y < height; y += 180) {
    ctx.fillRect(0, y, width, 1)
  }

  ctx.globalAlpha = 0.05
  for (let index = 0; index < 90; index++) {
    const x = (index * 211) % width
    const y = (index * 89) % height
    ctx.fillRect(x, y, 2, 2)
  }
}

function drawPhotoBacking(
  ctx: CanvasRenderingContext2D,
  slot: SlotConfig,
  frameColor: string,
  template: TemplateConfig,
) {
  const padding = template.blanko.photoPadding
  if (padding <= 0) return

  ctx.save()
  if (template.blanko.photoShadow) {
    ctx.shadowColor = template.id === 'mono' ? 'rgba(0,0,0,0.28)' : 'rgba(38,30,24,0.1)'
    ctx.shadowBlur = template.id === 'mono' ? 10 : 8
    ctx.shadowOffsetY = template.id === 'mono' ? 5 : 4
  }
  ctx.fillStyle = frameColor
  roundRect(
    ctx,
    slot.x - padding,
    slot.y - padding,
    slot.width + padding * 2,
    slot.height + padding * 2,
    template.blanko.photoRadius + padding,
  )
  ctx.fill()
  ctx.restore()
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

function loadImageSource(src: string): Promise<DecodedImage> {
  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => {
      resolve({
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
      })
    }

    image.onerror = () => {
      reject(new Error(`Failed to load image source: ${src}`))
    }

    image.src = src
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

async function drawTemplateLabel(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  template: TemplateConfig,
  layout: LayoutConfig,
) {
  if (template.footerLogo) {
    await drawFooterLogo(ctx, canvasWidth, canvasHeight, layout, template.footerLogo)
    return
  }

  if (!template.label.text) return

  ctx.save()
  ctx.fillStyle = template.textColor
  ctx.globalAlpha = template.id === 'mono' ? 0.78 : 0.7
  ctx.font = `700 ${template.label.fontSize * 0.58}px Poppins, sans-serif`
  ctx.textAlign = template.label.align
  const x =
    template.label.align === 'left'
      ? 90
      : template.label.align === 'right'
        ? canvasWidth - 90
        : canvasWidth / 2
  ctx.fillText(template.label.text, x, canvasHeight - 120)
  ctx.restore()
}

async function drawFooterLogo(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  layout: LayoutConfig,
  src: string,
) {
  const lastSlot = layout.slots[layout.slots.length - 1]
  if (!lastSlot) return

  const logo = await loadImageSource(src)
  const footerTop = lastSlot.y + lastSlot.height
  const footerHeight = canvasHeight - footerTop
  const logoWidth = Math.min(canvasWidth * 0.3, 340)
  const logoHeight = logoWidth * (logo.height / logo.width)
  const x = (canvasWidth - logoWidth) / 2
  const y = footerTop + Math.max(0, (footerHeight - logoHeight) / 2)

  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(logo.source, x, y, logoWidth, logoHeight)
  ctx.restore()
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
  ctx.fillStyle = template.textColor
  ctx.font = `${template.label.fontSize * 0.6}px Poppins, sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText(text, canvasWidth / 2, canvasHeight - 38)
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
  ctx.fillStyle = template.textColor
  ctx.font = `700 ${template.label.fontSize * 0.7}px Poppins, sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText(text, canvasWidth / 2, canvasHeight - 22)
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
