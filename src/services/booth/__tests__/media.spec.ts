import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import {
  collectBoothMediaTracks,
  isRemotePreviewReady,
  pickLiveAudioTrack,
  pickLiveVideoTrack,
} from '../preview'
import { selectRtcSender } from '../webrtc'
import {
  createFanoutBoothTransport,
  type BoothMediaSession,
  type BoothTransport,
} from '../transport'

function mediaTransport() {
  let local: MediaStream | null = null
  const remotes: Array<(stream: MediaStream | null) => void> = []

  const media: BoothMediaSession = {
    attachLocalStream(stream) {
      local = stream
    },
    subscribeRemoteStream(handler) {
      remotes.push(handler)
      return () => {
        const index = remotes.indexOf(handler)
        if (index >= 0) remotes.splice(index, 1)
      }
    },
  }

  const transport: BoothTransport = {
    send() {},
    subscribe() {
      return () => {}
    },
    media,
  }

  return {
    transport,
    get local() {
      return local
    },
    emit(stream: MediaStream | null) {
      for (const handler of remotes) handler(stream)
    },
  }
}

describe('booth live preview fanout', () => {
  it('forwards the local camera to a WebRTC child added later', () => {
    const fanout = createFanoutBoothTransport()
    const local = { id: 'local' } as unknown as MediaStream
    fanout.media?.attachLocalStream(local)

    const child = mediaTransport()
    fanout.add(child.transport)

    expect(child.local).toBe(local)
  })

  it('exposes the remote friend stream to subscribers', () => {
    const fanout = createFanoutBoothTransport()
    const child = mediaTransport()
    fanout.add(child.transport)

    const received: Array<MediaStream | null> = []
    const unsubscribe = fanout.media?.subscribeRemoteStream((stream) => {
      received.push(stream)
    })

    const remote = { id: 'remote' } as unknown as MediaStream
    child.emit(remote)

    expect(received).toEqual([remote])
    unsubscribe?.()
  })

  it('applies the saved microphone state before attaching a late child camera', () => {
    const fanout = createFanoutBoothTransport()
    const local = { id: 'local' } as unknown as MediaStream
    fanout.media?.setMicrophoneEnabled?.(false)
    fanout.media?.attachLocalStream(local)

    const calls: string[] = []
    const child = mediaTransport()
    child.transport.media!.setMicrophoneEnabled = (enabled) => calls.push(`mic:${enabled}`)
    child.transport.media!.attachLocalStream = () => calls.push('attach')
    fanout.add(child.transport)

    expect(calls).toEqual(['mic:false', 'attach'])
    fanout.media?.setMicrophoneEnabled?.(true)
    expect(calls).toEqual(['mic:false', 'attach', 'mic:true'])
  })

  it('forwards mute and unmute to every existing media child', () => {
    const fanout = createFanoutBoothTransport()
    const first = mediaTransport()
    const second = mediaTransport()
    const firstToggle = vi.fn()
    const secondToggle = vi.fn()
    first.transport.media!.setMicrophoneEnabled = firstToggle
    second.transport.media!.setMicrophoneEnabled = secondToggle
    fanout.add(first.transport)
    fanout.add(second.transport)

    fanout.media?.setMicrophoneEnabled?.(false)
    fanout.media?.setMicrophoneEnabled?.(true)

    expect(firstToggle.mock.calls).toEqual([[true], [false], [true]])
    expect(secondToggle.mock.calls).toEqual([[true], [false], [true]])
  })
})

describe('booth live preview readiness', () => {
  it('treats a remote video as ready once it has pixels, including small frames', () => {
    expect(isRemotePreviewReady({ srcObject: {}, videoWidth: 16, videoHeight: 16 })).toBe(true)
    expect(isRemotePreviewReady({ srcObject: {}, videoWidth: 640, videoHeight: 480 })).toBe(true)
    expect(isRemotePreviewReady({ srcObject: null, videoWidth: 640, videoHeight: 480 })).toBe(false)
    expect(isRemotePreviewReady({ srcObject: {}, videoWidth: 0, videoHeight: 0 })).toBe(false)
  })

  it('picks a live camera track and ignores ended tracks', () => {
    const live = { kind: 'video', readyState: 'live', id: 'live' } as MediaStreamTrack
    const ended = { kind: 'video', readyState: 'ended', id: 'ended' } as MediaStreamTrack
    const source = {
      getVideoTracks() {
        return [ended, live]
      },
    } as MediaStream

    expect(pickLiveVideoTrack(source)?.id).toBe('live')
    expect(pickLiveVideoTrack(null)).toBeNull()
  })

  it('picks a live microphone track and ignores ended tracks', () => {
    const live = { kind: 'audio', readyState: 'live', id: 'mic' } as MediaStreamTrack
    const ended = { kind: 'audio', readyState: 'ended', id: 'ended' } as MediaStreamTrack
    const source = {
      getAudioTracks() {
        return [ended, live]
      },
    } as MediaStream

    expect(pickLiveAudioTrack(source)?.id).toBe('mic')
    expect(pickLiveAudioTrack(null)).toBeNull()
  })

  it('keeps canvas video and mixes in the original microphone', () => {
    const canvasVideo = { kind: 'video', readyState: 'live', id: 'canvas' } as MediaStreamTrack
    const cameraVideo = { kind: 'video', readyState: 'live', id: 'camera' } as MediaStreamTrack
    const mic = { kind: 'audio', readyState: 'live', id: 'mic' } as MediaStreamTrack
    const processed = {
      getVideoTracks() {
        return [canvasVideo]
      },
      getAudioTracks() {
        return []
      },
    } as unknown as MediaStream
    const camera = {
      getVideoTracks() {
        return [cameraVideo]
      },
      getAudioTracks() {
        return [mic]
      },
    } as unknown as MediaStream

    expect(collectBoothMediaTracks(processed, camera).map((track) => track.id)).toEqual([
      'canvas',
      'mic',
    ])
  })

  it('selects the matching RTC sender instead of a vacant track slot', () => {
    const video = { track: { kind: 'video' } }
    const vacant = { track: null }
    const audio = { track: { kind: 'audio' } }

    expect(selectRtcSender([video, vacant, audio], 'audio')).toBe(audio)
    expect(selectRtcSender([video, vacant, audio], 'video')).toBe(video)
    expect(selectRtcSender([video, vacant], 'audio')).toBeUndefined()
  })

  it('allows same-origin microphone for booth voice', () => {
    const headers = readFileSync(
      fileURLToPath(new URL('../../../../public/_headers', import.meta.url)),
      'utf8',
    )
    const netlify = readFileSync(
      fileURLToPath(new URL('../../../../public/netlify.toml', import.meta.url)),
      'utf8',
    )

    expect(headers).toContain('microphone=(self)')
    expect(netlify).toContain('microphone=(self)')
    expect(headers).not.toMatch(/microphone=\(\)/)
    expect(netlify).not.toMatch(/microphone=\(\)/)
  })
})
