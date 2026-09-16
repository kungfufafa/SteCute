import { describe, expect, it } from 'vitest'
import { getShotForSlot } from '@/services/render/shots'

describe('getShotForSlot', () => {
  it('matches shots by order instead of array index', () => {
    const shots = [
      { order: 2, id: 'third' },
      { order: 0, id: 'first' },
    ]

    expect(getShotForSlot(shots, 0)?.id).toBe('first')
    expect(getShotForSlot(shots, 1)).toBeUndefined()
    expect(getShotForSlot(shots, 2)?.id).toBe('third')
  })
})
