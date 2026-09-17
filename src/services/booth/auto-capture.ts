export const BOOTH_AUTO_CAPTURE_GAP_MS = 800

export type BoothAutoCaptureAction = 'start' | 'wait' | 'stop'

export function nextBoothAutoCaptureAction(input: {
  enabled: boolean
  running: boolean
  shotsComplete: boolean
  stage: 'live' | 'review' | 'output'
  friendJoined: boolean
  canStart: boolean
}): BoothAutoCaptureAction {
  if (!input.enabled || !input.running) return 'stop'
  if (input.shotsComplete || input.stage !== 'live') return 'stop'
  if (input.canStart) return 'start'
  if (!input.friendJoined) return 'stop'
  return 'wait'
}
