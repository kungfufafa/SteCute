import { getObjectCoverCrop } from '@/services/camera/cover-crop'
import type { LiveCamClip } from '@/services/live-cam'
import { decodePng, encodeRgbaPng, isPng, type RgbaImage } from './png'

export const DEFAULT_PAIR_SLOT = { width: 1080, height: 810 } as const

export type BoothFaceBounds = {
  x: number
  y: number
  width: number
  height: number
}

export type BoothStill = {
  blob: Blob
  width: number
  height: number
  faceBounds?: BoothFaceBounds[]
  cameraEffectFrameMs?: number
}

export type ComposedPairShot = {
  blob: Blob
  width: number
  height: number
  faceBounds: BoothFaceBounds[]
  cameraEffectFrameMs: number
  liveClip?: LiveCamClip | null
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
    faceBounds: [
      ...mapFacesToPairHalf(host.faceBounds, hostImage, width, height, 0, hostWidth),
      ...mapFacesToPairHalf(guest.faceBounds, guestImage, width, height, hostWidth, guestWidth),
    ],
    cameraEffectFrameMs: resolvePairFrameMs(host.cameraEffectFrameMs, guest.cameraEffectFrameMs),
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

function coverCrop(
  sourceWidth: number,
  sourceHeight: number,
  destWidth: number,
  destHeight: number,
) {
  return getObjectCoverCrop(sourceWidth, sourceHeight, destWidth, destHeight)
}

function isRenderableFace(face: BoothFaceBounds) {
  return (
    Number.isFinite(face.x) &&
    Number.isFinite(face.y) &&
    Number.isFinite(face.width) &&
    Number.isFinite(face.height) &&
    face.width > 0 &&
    face.height > 0
  )
}

function mapFacesToPairHalf(
  faces: BoothFaceBounds[] | undefined,
  source: Pick<RgbaImage, 'width' | 'height'>,
  pairWidth: number,
  pairHeight: number,
  halfX: number,
  halfWidth: number,
): BoothFaceBounds[] {
  if (!faces?.length || !source.width || !source.height || halfWidth <= 0 || pairHeight <= 0) {
    return []
  }

  const crop = coverCrop(source.width, source.height, halfWidth, pairHeight)
  if (crop.sw <= 0 || crop.sh <= 0) return []

  return faces.filter(isRenderableFace).map((face) => ({
    x: (halfX + ((face.x * source.width - crop.sx) / crop.sw) * halfWidth) / pairWidth,
    y: (face.y * source.height - crop.sy) / crop.sh,
    width: ((face.width * source.width) / crop.sw) * (halfWidth / pairWidth),
    height: (face.height * source.height) / crop.sh,
  }))
}

function resolvePairFrameMs(hostFrameMs?: number, guestFrameMs?: number) {
  if (typeof hostFrameMs === 'number' && Number.isFinite(hostFrameMs)) return hostFrameMs
  if (typeof guestFrameMs === 'number' && Number.isFinite(guestFrameMs)) return guestFrameMs
  return 0
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
  if (!source.width || !source.height || dw <= 0 || dh <= 0) return

  const { sx, sy, sw, sh } = coverCrop(source.width, source.height, dw, dh)

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
