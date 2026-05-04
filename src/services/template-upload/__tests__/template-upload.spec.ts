import { describe, expect, it } from 'vitest'
import { findTransparentWindows } from '@/services/template-upload'

function alphaGrid(
  width: number,
  height: number,
  windows: Array<[number, number, number, number]>,
) {
  const alpha = new Uint8Array(width * height).fill(255)

  for (const [x, y, w, h] of windows) {
    for (let row = y; row < y + h; row++) {
      for (let col = x; col < x + w; col++) {
        alpha[row * width + col] = 0
      }
    }
  }

  return alpha
}

describe('strip template upload analysis', () => {
  it('finds transparent photo windows in reading order', () => {
    const windows = findTransparentWindows(
      alphaGrid(100, 200, [
        [10, 20, 80, 40],
        [10, 90, 80, 40],
        [10, 150, 80, 40],
      ]),
      100,
      200,
    )

    expect(windows).toMatchObject([
      { x: 10, y: 20, width: 80, height: 40 },
      { x: 10, y: 90, width: 80, height: 40 },
      { x: 10, y: 150, width: 80, height: 40 },
    ])
  })

  it('ignores transparent regions that touch the artboard edge', () => {
    const windows = findTransparentWindows(
      alphaGrid(100, 160, [
        [0, 0, 100, 20],
        [15, 40, 70, 40],
      ]),
      100,
      160,
    )

    expect(windows).toMatchObject([{ x: 15, y: 40, width: 70, height: 40 }])
  })
})
