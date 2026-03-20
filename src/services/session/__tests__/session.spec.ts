import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { createDecorationConfig } from '@/services/session'

describe('session decoration config', () => {
  it('clones reactive sticker arrays into plain arrays', () => {
    const source = reactive(['sparkle-1', 'heart-2'])

    const result = createDecorationConfig({
      selectedStickerIds: source,
    })

    expect(Array.isArray(result.selectedStickerIds)).toBe(true)
    expect(result.selectedStickerIds).toEqual(['sparkle-1', 'heart-2'])
    expect(result.selectedStickerIds).not.toBe(source)
  })
})
