import { describe, expect, it } from 'vitest'
import { shouldHoldPwaUpdate } from '@/services/pwa/update'

describe('PWA update prompt gating', () => {
  it('holds the prompt during capture, review, render, output, and booth', () => {
    expect(shouldHoldPwaUpdate('/camera')).toBe(true)
    expect(shouldHoldPwaUpdate('/upload')).toBe(true)
    expect(shouldHoldPwaUpdate('/review')).toBe(true)
    expect(shouldHoldPwaUpdate('/render')).toBe(true)
    expect(shouldHoldPwaUpdate('/output')).toBe(true)
    expect(shouldHoldPwaUpdate('/booth')).toBe(true)
    expect(shouldHoldPwaUpdate('/j/ABC-DEF')).toBe(true)
  })

  it('holds the prompt while a session is still in progress on other routes', () => {
    expect(shouldHoldPwaUpdate('/gallery', 'capturing')).toBe(true)
    expect(shouldHoldPwaUpdate('/config', 'rendering')).toBe(true)
  })

  it('allows the prompt on idle landing and gallery', () => {
    expect(shouldHoldPwaUpdate('/')).toBe(false)
    expect(shouldHoldPwaUpdate('/gallery', 'completed')).toBe(false)
    expect(shouldHoldPwaUpdate('/config', 'idle')).toBe(false)
    expect(shouldHoldPwaUpdate('/privacy')).toBe(false)
  })
})
