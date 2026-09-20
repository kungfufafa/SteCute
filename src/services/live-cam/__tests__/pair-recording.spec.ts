import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isLiveStripRenderingSupported, startPairLiveCamRecording } from '@/services/live-cam'

function readSource(relativePath: string) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

function functionBody(source: string, startMarker: string, endMarker: string) {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start)
  expect(start).toBeGreaterThan(-1)
  expect(end).toBeGreaterThan(start)
  return source.slice(start, end)
}

describe('booth pair live cam', () => {
  it('flips both pair halves when preview mirroring is requested', () => {
    const source = readFileSync(fileURLToPath(new URL('../index.ts', import.meta.url)), 'utf8')
    expect(source).toContain('remoteMirrored?: boolean')
    expect(source).toContain('options.localOnLeft ? localMirrored : remoteMirrored')
    expect(source).toContain('options.localOnLeft ? remoteMirrored : localMirrored')
  })

  it('does not start a pair recording without a live camera frame', () => {
    const video = {
      videoWidth: 0,
      videoHeight: 0,
      readyState: 0,
    } as HTMLVideoElement

    expect(startPairLiveCamRecording({
      localVideo: video,
      remoteVideo: null,
      width: 1080,
      height: 810,
      localOnLeft: true,
    })).toBeNull()
  })

  it('reports live-strip support from the real environment APIs', () => {
    expect(typeof isLiveStripRenderingSupported()).toBe('boolean')
  })
})

describe('live cam countdown recording', () => {
  it('starts camera recording when countdown begins, not only in the last 3 seconds', () => {
    const body = functionBody(
      readSource('../../../features/camera/CameraView.vue'),
      'function runCountdownAndCapture',
      'async function goBack',
    )

    expect(body).toContain('startLiveCamClip()')
    expect(body).not.toContain('countdownValue.value <= 3')
    expect(body).not.toContain('countdownValue.value === 3')
    expect(body.indexOf('startLiveCamClip()')).toBeLessThan(body.indexOf('setInterval'))
  })

  it('starts booth pair recording when the shared countdown begins', () => {
    const body = functionBody(
      readSource('../../../features/booth/BoothRoomView.vue'),
      'function runCountdown(',
      'function listenForRemoteCountdown',
    )

    expect(body).toContain('startBoothLiveCamClip()')
    expect(body).not.toContain('totalSeconds <= 3')
    expect(body).not.toContain('countdownValue.value === 3')
    expect(body.indexOf('startBoothLiveCamClip()')).toBeLessThan(body.indexOf('setInterval'))
  })

  it('keeps live-strip duration through the longest countdown plus shutter hold', () => {
    const source = readSource('../index.ts')
    const match = source.match(/LIVE_STRIP_MAX_DURATION_MS = ([0-9_]+)/)
    const maxDurationMs = Number(match?.[1]?.replaceAll('_', ''))
    const longestCountdownMs = 10_000
    const shutterHoldMs = 450

    expect(maxDurationMs).toBeGreaterThanOrEqual(longestCountdownMs + shutterHoldMs)
  })
})
