import { describe, expect, it } from 'vitest'
import { isRemotePreviewReady, pickLiveVideoTrack } from '../preview'
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
})
