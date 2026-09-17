import type { RgbaFrame, VirtualBackgroundSpec } from './compose'
import { normalizeVirtualBackgroundId } from './catalog'

export const MAX_HOST_BACKGROUND_DIMENSION = 1600
export const MAX_HOST_BACKGROUND_BYTES = 512 * 1024 // 512 KiB

export interface NormalizedCustomBackground {
  blob: Blob
  width: number
  height: number
  hash: string
}

let customBackgroundFrame: RgbaFrame | null = null

export function getCustomVirtualBackgroundFrame(): RgbaFrame | null {
  return customBackgroundFrame
}

export function setCustomVirtualBackgroundFrame(frame: RgbaFrame | null): void {
  customBackgroundFrame = frame
}

export function clearCustomVirtualBackgroundFrame(): void {
  customBackgroundFrame = null
}

export async function calculateBlobSha256(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function normalizeHostCustomBackground(file: Blob): Promise<NormalizedCustomBackground> {
  let sourceWidth = 0
  let sourceHeight = 0
  let drawSource: (ctx: CanvasRenderingContext2D, dx: number, dy: number, dw: number, dh: number) => void

  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file)
    sourceWidth = bitmap.width
    sourceHeight = bitmap.height
    drawSource = (ctx, dx, dy, dw, dh) => {
      ctx.drawImage(bitmap, dx, dy, dw, dh)
    }
    // We will close bitmap at the end
    try {
      return await processNormalization(sourceWidth, sourceHeight, drawSource)
    } finally {
      bitmap.close?.()
    }
  } else if (typeof Image !== 'undefined') {
    const url = URL.createObjectURL(file)
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image()
        el.onload = () => resolve(el)
        el.onerror = () => reject(new Error('Gagal memuat gambar latar.'))
        el.src = url
      })
      sourceWidth = img.naturalWidth || img.width
      sourceHeight = img.naturalHeight || img.height
      drawSource = (ctx, dx, dy, dw, dh) => {
        ctx.drawImage(img, dx, dy, dw, dh)
      }
      return await processNormalization(sourceWidth, sourceHeight, drawSource)
    } finally {
      URL.revokeObjectURL(url)
    }
  } else {
    throw new Error('Browser tidak mendukung decoding gambar.')
  }
}

async function processNormalization(
  srcW: number,
  srcH: number,
  drawer: (ctx: CanvasRenderingContext2D, dx: number, dy: number, dw: number, dh: number) => void,
): Promise<NormalizedCustomBackground> {
  let width = Math.max(1, Math.round(srcW))
  let height = Math.max(1, Math.round(srcH))

  // Scale down to max 1600px longest side
  const longest = Math.max(width, height)
  if (longest > MAX_HOST_BACKGROUND_DIMENSION) {
    const scale = MAX_HOST_BACKGROUND_DIMENSION / longest
    width = Math.max(1, Math.round(width * scale))
    height = Math.max(1, Math.round(height * scale))
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Gagal menyiapkan kanvas normalisasi latar.')

  // Flatten transparency to white
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  drawer(ctx, 0, 0, width, height)

  // Compress to JPEG <= 512 KiB
  const qualities = [0.92, 0.85, 0.75, 0.65, 0.5, 0.35]
  let finalBlob: Blob | null = null

  for (const quality of qualities) {
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
    })
    if (blob && blob.size <= MAX_HOST_BACKGROUND_BYTES) {
      finalBlob = blob
      break
    }
    finalBlob = blob
  }

  // If still exceeds 512 KiB, scale down further
  while (finalBlob && finalBlob.size > MAX_HOST_BACKGROUND_BYTES && width > 320 && height > 240) {
    width = Math.max(1, Math.round(width * 0.75))
    height = Math.max(1, Math.round(height * 0.75))
    canvas.width = width
    canvas.height = height
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    drawer(ctx, 0, 0, width, height)

    finalBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.6)
    })
  }

  if (!finalBlob) {
    throw new Error('Gagal mengompresi gambar latar host.')
  }

  const hash = await calculateBlobSha256(finalBlob)
  return {
    blob: finalBlob,
    width,
    height,
    hash,
  }
}

export async function loadCustomVirtualBackgroundFrame(file: Blob): Promise<RgbaFrame> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file)
    try {
      return frameFromImageSource(bitmap, bitmap.width, bitmap.height)
    } finally {
      bitmap.close?.()
    }
  }

  if (typeof Image !== 'undefined') {
    const url = URL.createObjectURL(file)
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image()
        el.onload = () => resolve(el)
        el.onerror = () => reject(new Error('Browser tidak bisa membaca gambar latar.'))
        el.src = url
      })
      return frameFromImageSource(img, img.naturalWidth || img.width, img.naturalHeight || img.height)
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  throw new Error('Browser tidak bisa membaca gambar latar.')
}

function frameFromImageSource(
  source: CanvasImageSource,
  width: number,
  height: number,
): RgbaFrame {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Gagal menyiapkan kanvas latar.')
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return {
    width: imageData.width,
    height: imageData.height,
    data: imageData.data,
  }
}

export function resolveVirtualBackgroundSpec(
  backgroundId?: string | null,
  customImage?: RgbaFrame | null,
): VirtualBackgroundSpec {
  return {
    id: normalizeVirtualBackgroundId(backgroundId),
    customImage: customImage ?? customBackgroundFrame,
  }
}

