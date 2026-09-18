export type BoothCapturePhase = 'idle' | 'countdown' | 'exchanging'

export function canBeginBoothCapture(state: {
  role: 'host' | 'guest'
  stage: 'live' | 'review' | 'output'
  friendJoined: boolean
  localCameraReady: boolean
  remoteCameraReady: boolean
  backgroundReady: boolean
  phase: BoothCapturePhase
  rendering: boolean
  shotsComplete: boolean
}): boolean {
  return (
    state.role === 'host' &&
    state.stage === 'live' &&
    state.friendJoined &&
    state.localCameraReady &&
    state.remoteCameraReady &&
    state.backgroundReady &&
    state.phase === 'idle' &&
    !state.rendering &&
    !state.shotsComplete
  )
}
