import { afterEach, describe, expect, it, vi } from 'vitest'
import { detectOutputCapabilities, shareBlob } from '@/services/output'

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

  it('treats a dismissed share sheet as cancelled, not unsupported', async () => {
    mockNavigator({
      share: vi.fn(async () => {
        const error = new Error('Share canceled')
        error.name = 'AbortError'
        throw error
      }),
      canShare: vi.fn(() => true),
    } as Partial<Navigator>)

    const blob = new Blob(['strip'], { type: 'image/png' })
    await expect(shareBlob(blob, 'stecute.png')).resolves.toBe('cancelled')
  })
})
