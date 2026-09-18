import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWebRtcBoothTransport } from '../webrtc'
import type { BoothTransport } from '../transport'

vi.mock('../ice', () => ({
  getBoothIceServers: vi.fn().mockResolvedValue([]),
  boothPeerRtcConfig: vi.fn().mockReturnValue({}),
}))
vi.mock('peerjs', () => ({ default: FakePeer }))

class FakeEmitter {
  private handlers = new Map<string, Set<(...args: unknown[]) => void>>()
  on(event: string, handler: (...args: unknown[]) => void) {
    const handlers = this.handlers.get(event) ?? new Set()
    handlers.add(handler)
    this.handlers.set(event, handlers)
  }
  off(event: string, handler: (...args: unknown[]) => void) {
    this.handlers.get(event)?.delete(handler)
  }
  emit(event: string, ...args: unknown[]) {
    for (const handler of this.handlers.get(event) ?? []) handler(...args)
  }
}

let trackSequence = 0
class FakeTrack {
  id = `track-${++trackSequence}`
  readyState = 'live'
  enabled = true
  readonly clones: FakeTrack[] = []
  constructor(public kind: 'audio' | 'video') {}
  clone() {
    const track = new FakeTrack(this.kind)
    track.enabled = this.enabled
    this.clones.push(track)
    return track
  }
  stop = vi.fn(() => {
    this.readyState = 'ended'
  })
}

class FakeStream {
  constructor(private tracks: FakeTrack[]) {}
  getTracks() {
    return this.tracks
  }
  getVideoTracks() {
    return this.tracks.filter((track) => track.kind === 'video')
  }
  getAudioTracks() {
    return this.tracks.filter((track) => track.kind === 'audio')
  }
}

class FakeSender {
  constructor(public track: FakeTrack | null) {}
  replaceTrack = vi.fn(async (track: FakeTrack | null) => {
    this.track = track
  })
}

class FakeCall extends FakeEmitter {
  peer = 'remote'
  senders: FakeSender[]
  constructor(public localStream: FakeStream) {
    super()
    this.senders = localStream.getTracks().map((track) => new FakeSender(track))
  }
  peerConnection = { getSenders: () => this.senders }
  answer(stream: FakeStream) {
    this.localStream = stream
    this.senders = stream.getTracks().map((track) => new FakeSender(track))
  }
  close = vi.fn(() => this.emit('close'))
}

class FakeConnection extends FakeEmitter {
  open = true
  peer = 'remote'
  close = vi.fn(() => {
    this.open = false
    this.emit('close')
  })
}

class FakePeer extends FakeEmitter {
  static instances: FakePeer[] = []
  id = 'local'
  disconnected = false
  calls: FakeCall[] = []
  constructor() {
    super()
    FakePeer.instances.push(this)
  }
  connect() {
    return new FakeConnection()
  }
  call(_peerId: string, stream: FakeStream) {
    const call = new FakeCall(stream)
    this.calls.push(call)
    return call
  }
  destroy = vi.fn()
}

function streamWithMicrophone() {
  const video = new FakeTrack('video')
  const audio = new FakeTrack('audio')
  const stream = new FakeStream([video, audio])
  return { video, audio, stream: stream as unknown as MediaStream }
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => (resolve = done))
  return { promise, resolve }
}

async function flushReplacement() {
  // updateOutbound waits once per sender, then publishes the new stream.
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('booth microphone transport control', () => {
  const transports: BoothTransport[] = []

  beforeEach(() => {
    vi.stubGlobal('MediaStream', FakeStream)
    FakePeer.instances = []
  })

  afterEach(() => {
    for (const transport of transports.splice(0)) transport.dispose?.()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  async function createTransport(role: 'host' | 'guest' = 'guest') {
    const transport = await createWebRtcBoothTransport('ABC123', role)
    transports.push(transport)
    return { transport, peer: FakePeer.instances[0]! }
  }

  it('mutes and unmutes the sent clone without stopping source tracks or changing video', async () => {
    const { transport, peer } = await createTransport()
    const source = streamWithMicrophone()
    transport.media!.attachLocalStream(source.stream)
    const call = peer.calls[0]!
    const sentAudio = call.localStream.getAudioTracks()[0]!
    const sentVideo = call.localStream.getVideoTracks()[0]!

    expect(sentAudio).not.toBe(source.audio)
    transport.media!.setMicrophoneEnabled!(false)
    expect(sentAudio.enabled).toBe(false)
    expect(sentVideo.enabled).toBe(true)
    expect(source.audio.enabled).toBe(true)
    expect(source.audio.stop).not.toHaveBeenCalled()
    expect(source.video.stop).not.toHaveBeenCalled()

    transport.media!.setMicrophoneEnabled!(true)
    expect(sentAudio.enabled).toBe(true)
    expect(peer.calls).toHaveLength(1)
    expect(call.senders.every((sender) => sender.replaceTrack.mock.calls.length === 0)).toBe(true)
  })

  it('keeps a muted microphone disabled on first attachment and call reconnect', async () => {
    vi.useFakeTimers()
    const { transport, peer } = await createTransport()
    const source = streamWithMicrophone()
    transport.media!.setMicrophoneEnabled!(false)
    transport.media!.attachLocalStream(source.stream)
    expect(peer.calls[0]!.localStream.getAudioTracks()[0]!.enabled).toBe(false)

    peer.calls[0]!.close()
    await vi.advanceTimersByTimeAsync(1_200)
    expect(peer.calls).toHaveLength(2)
    expect(peer.calls[1]!.localStream.getAudioTracks()[0]!.enabled).toBe(false)
  })

  it('applies the same microphone control when the host answers an incoming call', async () => {
    const { transport, peer } = await createTransport('host')
    const source = streamWithMicrophone()
    transport.media!.setMicrophoneEnabled!(false)
    transport.media!.attachLocalStream(source.stream)
    const incoming = new FakeCall(new FakeStream([]))
    peer.emit('call', incoming)

    const sentAudio = incoming.localStream.getAudioTracks()[0]!
    expect(sentAudio.enabled).toBe(false)
    transport.media!.setMicrophoneEnabled!(true)
    expect(sentAudio.enabled).toBe(true)
    transport.media!.setMicrophoneEnabled!(false)
    expect(sentAudio.enabled).toBe(false)
    expect(source.audio.stop).not.toHaveBeenCalled()
  })

  it('preserves mute when adding microphone audio requires a new media call', async () => {
    const { transport, peer } = await createTransport()
    transport.media!.attachLocalStream(
      new FakeStream([new FakeTrack('video')]) as unknown as MediaStream,
    )
    transport.media!.setMicrophoneEnabled!(false)
    const withAudio = streamWithMicrophone()
    transport.media!.attachLocalStream(withAudio.stream)
    await flushReplacement()

    expect(peer.calls).toHaveLength(2)
    expect(peer.calls[1]!.localStream.getAudioTracks()[0]!.enabled).toBe(false)
    expect(withAudio.audio.enabled).toBe(true)
  })

  it('preserves mute when a processed camera stream rebuilds outbound tracks', async () => {
    const { transport, peer } = await createTransport()
    transport.media!.attachLocalStream(streamWithMicrophone().stream)
    transport.media!.setMicrophoneEnabled!(false)
    const replacement = streamWithMicrophone()
    transport.media!.attachLocalStream(replacement.stream)
    await flushReplacement()

    const call = peer.calls[0]!
    const sentAudio = call.senders.find((sender) => sender.track?.kind === 'audio')!.track!
    expect(sentAudio).toBe(replacement.audio.clones[0])
    expect(sentAudio.enabled).toBe(false)
    expect(replacement.audio.enabled).toBe(true)
    expect(peer.calls).toHaveLength(1)
  })

  it('honors rapid toggles while video and audio replacements are still pending', async () => {
    const { transport, peer } = await createTransport()
    transport.media!.attachLocalStream(streamWithMicrophone().stream)
    const call = peer.calls[0]!
    const videoSender = call.senders.find((sender) => sender.track?.kind === 'video')!
    const audioSender = call.senders.find((sender) => sender.track?.kind === 'audio')!
    const originalAudio = audioSender.track!
    const pendingVideo = deferred()
    const pendingAudio = deferred()
    videoSender.replaceTrack.mockImplementation(async (track) => {
      await pendingVideo.promise
      videoSender.track = track
    })
    audioSender.replaceTrack.mockImplementation(async (track) => {
      await pendingAudio.promise
      audioSender.track = track
    })
    const replacement = streamWithMicrophone()
    transport.media!.attachLocalStream(replacement.stream)
    const pendingClone = replacement.audio.clones[0]!

    transport.media!.setMicrophoneEnabled!(false)
    expect(originalAudio.enabled).toBe(false)
    expect(pendingClone.enabled).toBe(false)
    pendingVideo.resolve()
    await flushReplacement()
    expect(audioSender.replaceTrack).toHaveBeenCalledWith(pendingClone)

    transport.media!.setMicrophoneEnabled!(true)
    expect(pendingClone.enabled).toBe(true)
    transport.media!.setMicrophoneEnabled!(false)
    pendingAudio.resolve()
    await flushReplacement()

    expect(audioSender.track).toBe(pendingClone)
    expect(audioSender.track!.enabled).toBe(false)
    expect(replacement.video.clones[0]!.enabled).toBe(true)
    expect(replacement.audio.stop).not.toHaveBeenCalled()
  })
})
