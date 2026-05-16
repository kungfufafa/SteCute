import { afterEach, describe, expect, it, vi } from 'vitest'
import { detectOutputCapabilities } from '@/services/output'

const originalNavigator = globalThis.navigator

function mockNavigator(value: Partial<Navigator>) {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value,
  })
}

describe('output capabilities', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: originalNavigator,
    })
  })

  it('does not expose share when the browser cannot share files', () => {
    const canShare = vi.fn(() => false)
    mockNavigator({
      share: vi.fn(),
      canShare,
    } as Partial<Navigator>)

    expect(detectOutputCapabilities().canShare).toBe(false)
    expect(canShare).toHaveBeenCalledOnce()
  })

  it('exposes share when file sharing is supported', () => {
    mockNavigator({
      share: vi.fn(),
      canShare: vi.fn(() => true),
    } as Partial<Navigator>)

    expect(detectOutputCapabilities().canShare).toBe(true)
  })
})
