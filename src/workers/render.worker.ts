// Web Worker for off-main-thread rendering
// Falls back to main thread if OffscreenCanvas is not available
import type { DecorationConfig, LayoutConfig, SlotConfig, TemplateConfig } from '@/db/schema'

export interface RenderWorkerMessage {
  type: 'render'
  layout: LayoutConfig
  template: TemplateConfig
  shots: ArrayBuffer[]
  decoration: DecorationConfig
  format: 'image/png' | 'image/jpeg'
  quality?: number
}

export interface RenderWorkerResult {
  type: 'result' | 'error'
  blob?: ArrayBuffer
  error?: string
  width?: number
  height?: number
}

self.onmessage = async (event: MessageEvent<RenderWorkerMessage>) => {
  const { type, layout, template, shots, decoration, format, quality } = event.data

  if (type !== 'render') return

  try {
    // Worker-based rendering using OffscreenCanvas (when available)
    // Falls back to main thread via the render service
    const canvas = new OffscreenCanvas(layout.canvas.width, layout.canvas.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get 2D canvas context')

    // Draw background
    ctx.fillStyle = template.background
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw shots into slots
    for (let i = 0; i < layout.slots.length; i++) {
      const slot = layout.slots[i]
      if (!shots[i]) continue

      const blob = new Blob([shots[i]], { type: 'image/png' })
      const bitmap = await createImageBitmap(blob)

      // Apply filter
      if (decoration.filterId && decoration.filterId !== 'normal') {
        ctx.filter = getCanvasFilter(decoration.filterId)
      } else {
        ctx.filter = 'none'
      }

      drawImageCover(ctx, bitmap, slot)
      bitmap.close()
    }

    ctx.filter = 'none'

    // Export
    const blob = await canvas.convertToBlob({ type: format, quality: quality ?? 1.0 })
    const buffer = await blob.arrayBuffer()

    const result: RenderWorkerResult = {
      type: 'result',
      blob: buffer,
      width: canvas.width,
      height: canvas.height,
    }

    self.postMessage(result, { transfer: [buffer] })
  } catch (error) {
    const result: RenderWorkerResult = {
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown render error',
    }
    self.postMessage(result)
  }
}

function drawImageCover(
  ctx: OffscreenCanvasRenderingContext2D,
  img: ImageBitmap,
  slot: SlotConfig,
) {
  const { x, y, width, height, radius } = slot
  const imgRatio = img.width / img.height
  const slotRatio = width / height

  let sx = 0, sy = 0, sw = img.width, sh = img.height

  if (imgRatio > slotRatio) {
    sw = img.height * slotRatio
    sx = (img.width - sw) / 2
  } else {
    sh = img.width / slotRatio
    sy = (img.height - sh) / 2
  }

  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, width, height, radius)
  ctx.clip()
  ctx.drawImage(img, sx, sy, sw, sh, x, y, width, height)
  ctx.restore()
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
