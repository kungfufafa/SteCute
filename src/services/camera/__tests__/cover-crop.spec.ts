import { describe, expect, it } from 'vitest'
import { strip4Config } from '@/layouts/strip-4/config'
import { getObjectCoverCrop } from '../cover-crop'
import { pairSlotForLayout } from '@/services/booth'

describe('booth capture matches strip pair-row geometry', () => {
  it('uses the selected layout slot split in half, same cover crop as compose', () => {
    const slot = pairSlotForLayout(strip4Config.id)
    expect(slot.width).toBe(strip4Config.slots[0].width)
    expect(slot.height).toBe(strip4Config.slots[0].height)

    const halfWidth = Math.floor(slot.width / 2)
    const halfHeight = slot.height
    expect(slot.width / slot.height).toBeCloseTo(4 / 3)
    expect(halfWidth / halfHeight).toBeCloseTo(2 / 3)

    const video = { width: 1920, height: 1080 }
    const liveCover = getObjectCoverCrop(video.width, video.height, halfWidth, halfHeight)
    const composeCover = getObjectCoverCrop(video.width, video.height, halfWidth, halfHeight)

    expect(liveCover).toEqual(composeCover)
    expect(liveCover.sw / liveCover.sh).toBeCloseTo(halfWidth / halfHeight)
  })
})
