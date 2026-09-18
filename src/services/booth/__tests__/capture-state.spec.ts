import { describe, expect, it } from 'vitest'
import { canBeginBoothCapture } from '../capture-state'

const ready = {
  role: 'host' as const,
  stage: 'live' as const,
  friendJoined: true,
  localCameraReady: true,
  remoteCameraReady: true,
  backgroundReady: true,
  phase: 'idle' as const,
  rendering: false,
  shotsComplete: false,
}

describe('booth capture transition guard', () => {
  it('requires both cameras even when the connection and background are ready', () => {
    expect(canBeginBoothCapture(ready)).toBe(true)
    expect(canBeginBoothCapture({ ...ready, localCameraReady: false })).toBe(false)
    expect(canBeginBoothCapture({ ...ready, remoteCameraReady: false })).toBe(false)
  })

  it('blocks a second start for the entire countdown and still exchange', () => {
    expect(canBeginBoothCapture({ ...ready, phase: 'countdown' })).toBe(false)
    expect(canBeginBoothCapture({ ...ready, phase: 'exchanging' })).toBe(false)
    expect(canBeginBoothCapture({ ...ready, shotsComplete: true })).toBe(false)
    expect(canBeginBoothCapture({ ...ready, friendJoined: false })).toBe(false)
  })
})
