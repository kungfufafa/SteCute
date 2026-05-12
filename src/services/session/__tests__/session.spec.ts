import { describe, expect, it } from 'vitest'
import { createDefaultDecorationConfig } from '@/services/session'

describe('session decoration config', () => {
  it('creates default decoration config with correct shape', () => {
    const result = createDefaultDecorationConfig({ defaultFrameColor: '#ffffff' })

    expect(Array.isArray(result.selectedStickerIds)).toBe(true)
    expect(result.filterId).toBe('normal')
    expect(result.cameraEffectId).toBe('none')
    expect(result.frameColor).toBe('#ffffff')
    expect(result.showDateTime).toBe(false)
  })

  it('creates decoration config with empty stickers by default', () => {
    const result = createDefaultDecorationConfig()
    expect(result.selectedStickerIds).not.toBe(undefined)
    expect(Array.isArray(result.selectedStickerIds)).toBe(true)
    expect(result.selectedStickerIds).toHaveLength(0)
  })

  it('normalizes supported and unsupported filter overrides', () => {
    expect(createDefaultDecorationConfig(undefined, { filterId: 'warm' }).filterId).toBe('warm')
    expect(createDefaultDecorationConfig(undefined, { filterId: 'unknown' }).filterId).toBe(
      'normal',
    )
  })

  it('normalizes supported and unsupported camera overlay overrides', () => {
    expect(
      createDefaultDecorationConfig(undefined, { cameraEffectId: 'hearts' }).cameraEffectId,
    ).toBe('hearts')
    expect(
      createDefaultDecorationConfig(undefined, { cameraEffectId: 'kicau-mania' }).cameraEffectId,
    ).toBe('kicau-mania')
    expect(
      createDefaultDecorationConfig(undefined, { cameraEffectId: 'unknown' }).cameraEffectId,
    ).toBe('none')
  })
})
