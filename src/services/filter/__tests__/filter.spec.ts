import { describe, expect, it } from 'vitest'
import {
  PHOTO_FILTERS,
  getPhotoFilterById,
  getPhotoFilterCanvas,
  getPhotoFilterCss,
  normalizePhotoFilterId,
} from '@/services/filter'

describe('photo filters', () => {
  it('exposes normal plus several camera effects', () => {
    expect(PHOTO_FILTERS.map((filter) => filter.id)).toEqual(
      expect.arrayContaining(['normal', 'bw', 'noir', 'warm', 'cool', 'vintage', 'pop']),
    )
    expect(PHOTO_FILTERS.length).toBeGreaterThanOrEqual(10)
  })

  it('falls back to normal for unknown filter ids', () => {
    expect(getPhotoFilterById('missing').id).toBe('normal')
    expect(normalizePhotoFilterId('missing')).toBe('normal')
  })

  it('returns CSS and canvas filters from the same catalog', () => {
    expect(getPhotoFilterCss('warm')).toContain('sepia')
    expect(getPhotoFilterCanvas('warm')).toContain('sepia')
    expect(getPhotoFilterCss('normal')).toBe('none')
  })
})
