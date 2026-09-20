import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatBytes, formatGalleryDate } from '@/utils/format'

describe('formatBytes', () => {
  it('shows whole bytes under a kilobyte', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
  })
})

describe('formatGalleryDate', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('labels a timestamp from today as Hari ini', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-20T10:15:00'))

    expect(formatGalleryDate(new Date('2026-09-20T02:00:00').getTime())).toMatch(/^Hari ini · /)
  })

  it('labels yesterday as Kemarin', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-20T10:15:00'))

    expect(formatGalleryDate(new Date('2026-09-19T14:22:00').getTime())).toMatch(/^Kemarin · /)
  })
})
