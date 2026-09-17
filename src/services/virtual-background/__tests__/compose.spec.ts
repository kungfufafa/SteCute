import { describe, expect, it } from 'vitest'
import {
  applyVirtualBackgroundOrPassthrough,
  composeVirtualBackground,
  getVirtualBackgroundById,
  parseBackgroundColor,
  type PersonMask,
  type RgbaFrame,
} from '@/services/virtual-background'

function makeFrame(
  width: number,
  height: number,
  fill: (x: number, y: number) => [number, number, number, number],
): RgbaFrame {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = fill(x, y)
      const offset = (y * width + x) * 4
      data[offset] = r
      data[offset + 1] = g
      data[offset + 2] = b
      data[offset + 3] = a
    }
  }
  return { width, height, data }
}

function pixelAt(frame: RgbaFrame, x: number, y: number): [number, number, number, number] {
  const offset = (y * frame.width + x) * 4
  return [frame.data[offset], frame.data[offset + 1], frame.data[offset + 2], frame.data[offset + 3]]
}

function personOnLeftMask(width: number, height: number): PersonMask {
  const data = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data[y * width + x] = x < width / 2 ? 255 : 0
    }
  }
  return { width, height, data }
}

const source = makeFrame(8, 8, (x, y) => {
  if (x < 4) return [220, 24, 32, 255]
  return [y % 2 === 0 ? 16 : 240, 180, x * 28, 255]
})
const mask = personOnLeftMask(8, 8)

describe('virtual background compositor', () => {
  it('fills only non-person pixels with solid pink and solid blue', () => {
    const pink = parseBackgroundColor(getVirtualBackgroundById('pink').color ?? '')
    const blue = parseBackgroundColor(getVirtualBackgroundById('blue').color ?? '')

    const pinkFrame = composeVirtualBackground(source, mask, { id: 'pink' })
    const blueFrame = composeVirtualBackground(source, mask, { id: 'blue' })

    expect(pixelAt(pinkFrame, 1, 2)).toEqual(pixelAt(source, 1, 2))
    expect(pixelAt(pinkFrame, 6, 2)).toEqual([pink[0], pink[1], pink[2], 255])
    expect(pixelAt(blueFrame, 1, 5)).toEqual(pixelAt(source, 1, 5))
    expect(pixelAt(blueFrame, 6, 5)).toEqual([blue[0], blue[1], blue[2], 255])
    expect(pixelAt(source, 6, 2)).not.toEqual([pink[0], pink[1], pink[2], 255])
  })

  it('leaves person pixels unblurred and changes the room relative to the sharp source', () => {
    const blurred = composeVirtualBackground(source, mask, { id: 'blur' }, { blurRadius: 2 })

    expect(pixelAt(blurred, 1, 3)).toEqual(pixelAt(source, 1, 3))
    expect(pixelAt(blurred, 6, 3)).not.toEqual(pixelAt(source, 6, 3))
    expect(pixelAt(blurred, 7, 0)).not.toEqual(pixelAt(source, 7, 0))
  })

  it('draws an uploaded image only in non-person pixels', () => {
    const customImage = makeFrame(8, 8, () => [32, 64, 220, 255])
    const composited = composeVirtualBackground(source, mask, {
      id: 'custom',
      customImage,
    })

    expect(pixelAt(composited, 2, 2)).toEqual(pixelAt(source, 2, 2))
    expect(pixelAt(composited, 6, 2)).toEqual([32, 64, 220, 255])
  })

  it('returns the original frame when the mode is off, unknown, or the mask is missing', () => {
    expect(composeVirtualBackground(source, mask, { id: 'off' })).toBe(source)
    expect(composeVirtualBackground(source, mask, { id: 'not-a-background' })).toBe(source)
    expect(composeVirtualBackground(source, null, { id: 'pink' })).toBe(source)
    expect(applyVirtualBackgroundOrPassthrough(source, null, { id: 'blur' })).toBe(source)
    expect(composeVirtualBackground(source, mask, { id: 'custom' })).toBe(source)
  })
})
