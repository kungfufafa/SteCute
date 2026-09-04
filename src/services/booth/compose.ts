import { decodePng, encodeRgbaPng, isPng, type RgbaImage } from './png'

export const DEFAULT_PAIR_SLOT = { width: 1080, height: 810 } as const

export type BoothStill = {
  blob: Blob
  width: number
  height: number
}

export type ComposedPairShot = {
  blob: Blob
  width: number
  height: number
}

export async function composePairRow(
  host: BoothStill,
  guest: BoothStill,
  slot: { width: number; height: number } = DEFAULT_PAIR_SLOT,
): Promise<ComposedPairShot> {
  const width = Math.max(2, Math.floor(slot.width))
  const height = Math.max(1, Math.floor(slot.height))
  const hostWidth = Math.floor(width / 2)
  const guestWidth = width - hostWidth
  const hostImage = await decodeStill(host.blob)
  const guestImage = await decodeStill(guest.blob)
  const pixels = new Uint8ClampedArray(width * height * 4)

  blitCover(hostImage, pixels, width, 0, 0, hostWidth, height)
  blitCover(guestImage, pixels, width, hostWidth, 0, guestWidth, height)

  const png = encodeRgbaPng(width, height, pixels)
  const copy = new Uint8Array(png)

  return {
    blob: new Blob([copy], { type: 'image/png' }),
    width,
    height,
  }
}

export async function decodeStill(blob: Blob): Promise<RgbaImage> {
  const bytes = new Uint8Array(await blob.arrayBuffer())

  if (isPng(bytes)) {
    try {
      return decodePng(bytes)
    } catch {
      // Fall through to bitmap decoding for compressed camera PNGs.
    }
  }

  return decodeStillViaBitmap(blob)
}

function blitCover(
  source: RgbaImage,
  dest: Uint8ClampedArray,
  destWidth: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  const sourceRatio = source.width / source.height
  const destRatio = dw / dh
  let sx = 0
  let sy = 0
  let sw = source.width
  let sh = source.height

  if (!source.width || !source.height || dw <= 0 || dh <= 0) return

  if (sourceRatio > destRatio) {
    sw = source.height * destRatio
    sx = (source.width - sw) / 2
  } else {
    sh = source.width / destRatio
    sy = (source.height - sh) / 2
  }

  for (let y = 0; y < dh; y++) {
    const sourceY = Math.min(source.height - 1, Math.floor(sy + ((y + 0.5) * sh) / dh))

    for (let x = 0; x < dw; x++) {
      const sourceX = Math.min(source.width - 1, Math.floor(sx + ((x + 0.5) * sw) / dw))
      const si = (sourceY * source.width + sourceX) * 4
      const di = ((dy + y) * destWidth + (dx + x)) * 4
      dest[di] = source.data[si]
      dest[di + 1] = source.data[si + 1]
      dest[di + 2] = source.data[si + 2]
      dest[di + 3] = source.data[si + 3]
    }
  }
}

async function decodeStillViaBitmap(blob: Blob): Promise<RgbaImage> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
    throw new Error('Unable to decode booth still.')
  }

  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    throw new Error('Unable to decode booth still.')
  }

  context.drawImage(bitmap, 0, 0)
  const imageData = context.getImageData(0, 0, bitmap.width, bitmap.height)
  bitmap.close()

  return {
    width: imageData.width,
    height: imageData.height,
    data: imageData.data,
  }
}
