import { getObjectCoverCrop } from '@/services/camera/cover-crop'
import {
  getVirtualBackgroundById,
  parseBackgroundColor,
  type VirtualBackgroundConfig,
} from './catalog'

export interface RgbaFrame {
  width: number
  height: number
  data: Uint8ClampedArray
}

export interface PersonMask {
  width: number
  height: number
  data: Uint8Array | Uint8ClampedArray
}

export interface VirtualBackgroundSpec {
  id?: string | null
  customImage?: RgbaFrame | null
}

export interface ComposeVirtualBackgroundOptions {
  blurRadius?: number
}

const DEFAULT_BLUR_RADIUS = 8

export function composeVirtualBackground(
  source: RgbaFrame,
  mask: PersonMask | null | undefined,
  spec: VirtualBackgroundSpec = {},
  options: ComposeVirtualBackgroundOptions = {},
): RgbaFrame {
  const background = getVirtualBackgroundById(spec.id)
  if (background.mode === 'off') return source
  if (!mask || mask.width <= 0 || mask.height <= 0 || mask.data.length === 0) return source
  if (!source.width || !source.height || source.data.length < source.width * source.height * 4) {
    return source
  }
  if (background.mode === 'custom' && !spec.customImage) return source

  const output = new Uint8ClampedArray(source.data)
  const personLookup = buildPersonLookup(mask)
  const blurRadius = Math.max(1, Math.round(options.blurRadius ?? DEFAULT_BLUR_RADIUS))
  const blurred =
    background.mode === 'blur' ? boxBlur(source.data, source.width, source.height, blurRadius) : null

  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      const alpha = samplePersonAlpha(personLookup, x, y, source.width, source.height)
      if (alpha >= 1) continue

      const offset = (y * source.width + x) * 4
      const [backgroundR, backgroundG, backgroundB] = sampleBackgroundPixel(
        background,
        spec.customImage,
        blurred,
        source,
        x,
        y,
      )

      if (alpha <= 0) {
        output[offset] = backgroundR
        output[offset + 1] = backgroundG
        output[offset + 2] = backgroundB
        output[offset + 3] = 255
        continue
      }

      const inv = 1 - alpha
      output[offset] = Math.round(source.data[offset] * alpha + backgroundR * inv)
      output[offset + 1] = Math.round(source.data[offset + 1] * alpha + backgroundG * inv)
      output[offset + 2] = Math.round(source.data[offset + 2] * alpha + backgroundB * inv)
      output[offset + 3] = 255
    }
  }

  return {
    width: source.width,
    height: source.height,
    data: output,
  }
}

function sampleBackgroundPixel(
  background: VirtualBackgroundConfig,
  customImage: RgbaFrame | null | undefined,
  blurred: Uint8ClampedArray | null,
  source: RgbaFrame,
  x: number,
  y: number,
): [number, number, number] {
  if (background.mode === 'color') {
    return parseBackgroundColor(background.color ?? '#f8fafc')
  }

  if (background.mode === 'blur' && blurred) {
    const offset = (y * source.width + x) * 4
    return [blurred[offset], blurred[offset + 1], blurred[offset + 2]]
  }

  if (background.mode === 'custom' && customImage) {
    return sampleCoverPixel(customImage, source.width, source.height, x, y)
  }

  const offset = (y * source.width + x) * 4
  return [source.data[offset], source.data[offset + 1], source.data[offset + 2]]
}

function sampleCoverPixel(
  image: RgbaFrame,
  destWidth: number,
  destHeight: number,
  x: number,
  y: number,
): [number, number, number] {
  const crop = getObjectCoverCrop(image.width, image.height, destWidth, destHeight)
  const srcX = Math.min(
    image.width - 1,
    Math.max(0, Math.floor(crop.sx + ((x + 0.5) * crop.sw) / destWidth)),
  )
  const srcY = Math.min(
    image.height - 1,
    Math.max(0, Math.floor(crop.sy + ((y + 0.5) * crop.sh) / destHeight)),
  )
  const offset = (srcY * image.width + srcX) * 4
  return [image.data[offset], image.data[offset + 1], image.data[offset + 2]]
}

function buildPersonLookup(mask: PersonMask) {
  let max = 0
  for (let index = 0; index < mask.data.length; index++) {
    if (mask.data[index] > max) max = mask.data[index]
  }

  return { mask, max }
}

function samplePersonAlpha(
  lookup: { mask: PersonMask; max: number },
  x: number,
  y: number,
  destWidth: number,
  destHeight: number,
): number {
  const { mask, max } = lookup
  const mx = Math.min(mask.width - 1, Math.max(0, Math.floor(((x + 0.5) * mask.width) / destWidth)))
  const my = Math.min(
    mask.height - 1,
    Math.max(0, Math.floor(((y + 0.5) * mask.height) / destHeight)),
  )
  const value = mask.data[my * mask.width + mx] ?? 0
  if (max <= 1) return value > 0 ? 1 : 0
  return value / 255
}

function boxBlur(
  source: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
): Uint8ClampedArray {
  const tmp = new Uint8ClampedArray(source.length)
  const out = new Uint8ClampedArray(source.length)
  blurAxis(source, tmp, width, height, radius, true)
  blurAxis(tmp, out, width, height, radius, false)
  return out
}

function blurAxis(
  source: Uint8ClampedArray,
  dest: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
  horizontal: boolean,
): void {
  const windowSize = radius * 2 + 1

  if (horizontal) {
    for (let y = 0; y < height; y++) {
      for (let channel = 0; channel < 3; channel++) {
        let sum = 0
        for (let kx = -radius; kx <= radius; kx++) {
          sum += source[(y * width + clamp(kx, 0, width - 1)) * 4 + channel]
        }
        for (let x = 0; x < width; x++) {
          dest[(y * width + x) * 4 + channel] = Math.round(sum / windowSize)
          const leave = source[(y * width + clamp(x - radius, 0, width - 1)) * 4 + channel]
          const enter = source[(y * width + clamp(x + radius + 1, 0, width - 1)) * 4 + channel]
          sum += enter - leave
        }
      }
      for (let x = 0; x < width; x++) dest[(y * width + x) * 4 + 3] = 255
    }
    return
  }

  for (let x = 0; x < width; x++) {
    for (let channel = 0; channel < 3; channel++) {
      let sum = 0
      for (let ky = -radius; ky <= radius; ky++) {
        sum += source[(clamp(ky, 0, height - 1) * width + x) * 4 + channel]
      }
      for (let y = 0; y < height; y++) {
        dest[(y * width + x) * 4 + channel] = Math.round(sum / windowSize)
        const leave = source[(clamp(y - radius, 0, height - 1) * width + x) * 4 + channel]
        const enter = source[(clamp(y + radius + 1, 0, height - 1) * width + x) * 4 + channel]
        sum += enter - leave
      }
    }
    for (let y = 0; y < height; y++) dest[(y * width + x) * 4 + 3] = 255
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
