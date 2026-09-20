import type { DataConnection, MediaConnection, Peer } from 'peerjs'
import { boothPeerRtcConfig, getBoothIceServers } from './ice'
import { collectBoothMediaTracks, pickLiveAudioTrack, pickLiveVideoTrack } from './preview'
import type { BoothTransport, BoothWireMessage } from './transport'

const PEER_OPEN_TIMEOUT_MS = 10_000
const GUEST_CONNECT_TIMEOUT_MS = 20_000
const GUEST_RETRY_DELAY_MS = 1_200
const HOST_ID_RETRY_DELAY_MS = 1_000

export function boothHostPeerId(normalizedCode: string): string {
  return `stc-${normalizedCode.toLowerCase()}`
}

export async function createWebRtcBoothTransport(
  normalizedCode: string,
  role: 'host' | 'guest',
  signal?: AbortSignal,
): Promise<BoothTransport> {
  throwIfAborted(signal)
  const { default: Peer } = await import('peerjs')
  const handlers = new Set<(message: BoothWireMessage) => void>()
  const connections = new Set<DataConnection>()
  const remoteHandlers = new Set<(stream: MediaStream | null) => void>()
  let disposed = false
  let localStream: MediaStream | null = null
  let outboundStream: MediaStream | null = null
  let microphoneEnabled = true
  const pendingOutboundTracks = new Set<MediaStreamTrack>()
  let remoteStream: MediaStream | null = null
  let mediaCall: MediaConnection | null = null
  let pendingIncoming: MediaConnection | null = null
  let answerTimer: ReturnType<typeof setTimeout> | null = null
  const hostId = boothHostPeerId(normalizedCode)
  const iceServers = await getBoothIceServers(signal)
  const rtcConfig = boothPeerRtcConfig(iceServers)
  const peer =
    role === 'host'
      ? await openHostPeer(Peer, hostId, rtcConfig, signal)
      : await openGuestPeer(Peer, rtcConfig, signal)

  const onAbort = () => {
    if (disposed) return
    disposed = true
    closeMedia()
    peer.destroy()
  }
  signal?.addEventListener('abort', onAbort)

  peer.on('connection', (connection) => attachConnection(connection))
  peer.on('call', (incoming) => handleIncomingCall(incoming))
  peer.on('error', (error) => {
    if (isIgnorablePeerError(error)) return
    console.warn('Booth WebRTC peer error:', error)
  })

  if (role === 'guest') {
    void retryGuestConnect(peer, hostId)
  }

  function hasOtherOpenConnection(except?: DataConnection) {
    for (const connection of connections) {
      if (connection !== except && connection.open) return true
    }
    return false
  }

  function attachConnection(connection: DataConnection) {
    const acceptIfPrimary = () => {
      if (disposed || !connection.open) {
        connection.close()
        return
      }
      if (role === 'host' && hasOtherOpenConnection(connection)) {
        connection.close()
        return
      }
      connections.add(connection)
      tryStartMediaCall()
    }

    connection.on('open', acceptIfPrimary)
    connection.on('data', (data) => {
      if (role === 'host' && !connections.has(connection) && hasOtherOpenConnection(connection)) {
        connection.close()
        return
      }
      const message = decodeBoothWirePayload(data)
      if (!message) return
      for (const handler of handlers) handler(message)
    })
    connection.on('close', () => connections.delete(connection))
    connection.on('error', () => connections.delete(connection))
    if (connection.open && !disposed) acceptIfPrimary()
  }

  async function retryGuestConnect(guestPeer: Peer, targetId: string) {
    try {
      while (!disposed && !hasOpenConnection()) {
        throwIfAborted(signal)
        const connection = guestPeer.connect(targetId, { reliable: true })
        attachConnection(connection)

        try {
          await waitForConnectionOpen(connection, GUEST_CONNECT_TIMEOUT_MS)
          if (connection.open && !disposed) {
            connections.add(connection)
            tryStartMediaCall()
            return
          }
        } catch (error) {
          connection.close()
          connections.delete(connection)
          if (disposed || signal?.aborted) return
          if (error instanceof Error && error.message.includes('aborted')) return
        }

        await sleep(GUEST_RETRY_DELAY_MS, signal)
      }
    } catch {
      return
    }
  }

  function hasOpenConnection() {
    for (const connection of connections) {
      if (connection.open) return true
    }
    return false
  }

  function isKnownPeer(peerId: string) {
    if (!peerId) return false
    for (const connection of connections) {
      if (connection.open && connection.peer === peerId) return true
    }
    return !hasOpenConnection()
  }

  function emitRemote(stream: MediaStream | null) {
    remoteStream = stream
    for (const handler of remoteHandlers) handler(stream)
  }

  function remoteMediaStream(stream: MediaStream) {
    const tracks = collectBoothMediaTracks(stream, stream)
    return new MediaStream(tracks)
  }

  function isLocalCameraTrack(track: MediaStreamTrack) {
    return Boolean(localStream?.getTracks().some((item) => item.id === track.id))
  }

  function stopOutboundTracks(except: MediaStreamTrack[] = []) {
    if (!outboundStream) return
    for (const track of outboundStream.getTracks()) {
      if (except.includes(track) || isLocalCameraTrack(track)) continue
      track.stop()
    }
    if (!except.length) outboundStream = null
  }

  function prepareOutbound(source: MediaStream | null) {
    const nextTracks = cloneOutboundTracks(source)
    if (!nextTracks) {
      stopOutboundTracks()
      outboundStream = null
      return null
    }
    applyMicrophoneState(nextTracks)
    stopOutboundTracks(nextTracks)
    outboundStream = new MediaStream(nextTracks)
    return outboundStream
  }

  function applyMicrophoneState(tracks: Iterable<MediaStreamTrack>) {
    for (const track of tracks) {
      if (track.kind === 'audio') track.enabled = microphoneEnabled
    }
  }

  function syncMicrophoneState() {
    applyMicrophoneState(outboundStream?.getTracks() ?? [])
    applyMicrophoneState(pendingOutboundTracks)
    for (const sender of mediaCall?.peerConnection?.getSenders() ?? []) {
      if (sender.track?.kind === 'audio') sender.track.enabled = microphoneEnabled
    }
  }

  function clearAnswerTimer() {
    if (!answerTimer) return
    clearTimeout(answerTimer)
    answerTimer = null
  }

  function handleIncomingCall(incoming: MediaConnection) {
    if (disposed) {
      incoming.close()
      return
    }
    if (role === 'host' && hasOtherOpenConnection() && !isKnownPeer(incoming.peer)) {
      incoming.close()
      return
    }
    if (mediaCall && mediaCall !== incoming) {
      incoming.close()
      return
    }
    pendingIncoming = incoming
    maybeAnswerIncoming()
  }

  function maybeAnswerIncoming() {
    if (disposed || !pendingIncoming) return
    const outbound = outboundStream ?? prepareOutbound(localStream)
    if (!outbound) {
      if (!answerTimer) {
        answerTimer = setTimeout(() => {
          answerTimer = null
          maybeAnswerIncoming()
        }, 250)
      }
      return
    }

    clearAnswerTimer()
    const incoming = pendingIncoming
    pendingIncoming = null
    bindMediaCall(incoming)
    incoming.answer(outbound)
  }

  function bindMediaCall(connection: MediaConnection) {
    if (mediaCall && mediaCall !== connection) mediaCall.close()
    mediaCall = connection

    connection.on('stream', (stream) => {
      if (mediaCall !== connection) return
      emitRemote(remoteMediaStream(stream))
    })
    connection.on('close', () => {
      if (mediaCall !== connection) return
      mediaCall = null
      emitRemote(null)
      if (!disposed && role === 'guest') {
        void sleep(GUEST_RETRY_DELAY_MS, signal)
          .then(() => tryStartMediaCall())
          .catch(() => undefined)
      }
    })
    connection.on('error', () => {
      if (mediaCall !== connection) return
      mediaCall = null
      emitRemote(null)
    })

    if (connection.remoteStream) emitRemote(remoteMediaStream(connection.remoteStream))
  }

  function tryStartMediaCall() {
    if (disposed || role !== 'guest') return
    if (mediaCall || pendingIncoming) return
    if (!hasOpenConnection()) return
    const outbound = outboundStream ?? prepareOutbound(localStream)
    if (!outbound) return

    const call = peer.call(hostId, outbound, { metadata: { booth: 'preview' } })
    bindMediaCall(call)
  }

  async function updateOutbound(source: MediaStream | null) {
    const nextTracks = cloneOutboundTracks(source)
    if (!nextTracks) return

    applyMicrophoneState(nextTracks)
    for (const track of nextTracks) pendingOutboundTracks.add(track)

    try {
      await replaceOutbound(nextTracks)
    } finally {
      for (const track of nextTracks) pendingOutboundTracks.delete(track)
    }
  }

  async function replaceOutbound(nextTracks: MediaStreamTrack[]) {
    const nextVideo = nextTracks.find((track) => track.kind === 'video') ?? null
    const nextAudio = nextTracks.find((track) => track.kind === 'audio') ?? null
    const senders = mediaCall?.peerConnection?.getSenders() ?? []
    const videoSender = selectRtcSender(senders, 'video')
    const audioSender = selectRtcSender(senders, 'audio')
    const canReplace = Boolean(videoSender) && !(nextAudio && !audioSender)

    if (canReplace) {
      try {
        await videoSender?.replaceTrack(nextVideo)
        applyMicrophoneState(nextTracks)
        await audioSender?.replaceTrack(nextAudio)
        syncMicrophoneState()
        if (disposed) return
        stopOutboundTracks(nextTracks)
        outboundStream = new MediaStream(nextTracks)
        return
      } catch {
        // Fall through and renegotiate from the guest side.
      }
    }

    if (disposed) return
    applyMicrophoneState(nextTracks)
    stopOutboundTracks(nextTracks)
    outboundStream = new MediaStream(nextTracks)
    if (pendingIncoming) {
      maybeAnswerIncoming()
      return
    }
    mediaCall?.close()
    mediaCall = null
    tryStartMediaCall()
  }

  function closeMedia() {
    clearAnswerTimer()
    pendingIncoming?.close()
    pendingIncoming = null
    mediaCall?.close()
    mediaCall = null
    stopOutboundTracks()
    for (const track of pendingOutboundTracks) {
      if (!isLocalCameraTrack(track)) track.stop()
    }
    pendingOutboundTracks.clear()
    emitRemote(null)
    remoteHandlers.clear()
  }

  return {
    send(message) {
      const payload = encodeBoothWirePayload(message)
      for (const connection of connections) {
        if (!connection.open) continue
        connection.send(payload)
      }
    },
    subscribe(handler) {
      handlers.add(handler)
      return () => handlers.delete(handler)
    },
    media: {
      setMicrophoneEnabled(enabled) {
        if (disposed) return
        microphoneEnabled = enabled
        syncMicrophoneState()
      },
      attachLocalStream(stream) {
        if (disposed) return
        localStream = stream
        if (pendingIncoming) {
          maybeAnswerIncoming()
          return
        }
        if (mediaCall) {
          void updateOutbound(stream)
          return
        }
        outboundStream = prepareOutbound(stream)
        tryStartMediaCall()
      },
      subscribeRemoteStream(handler) {
        remoteHandlers.add(handler)
        if (remoteStream) handler(remoteStream)
        return () => remoteHandlers.delete(handler)
      },
    },
    dispose() {
      disposed = true
      signal?.removeEventListener('abort', onAbort)
      closeMedia()
      for (const connection of connections) connection.close()
      connections.clear()
      handlers.clear()
      peer.destroy()
    },
  }
}

export function selectRtcSender<T extends { track?: { kind: string } | null }>(
  senders: T[],
  kind: 'audio' | 'video',
): T | undefined {
  return senders.find((item) => item.track?.kind === kind)
}

function cloneTrack(track: MediaStreamTrack | null): MediaStreamTrack | null {
  if (!track) return null

  try {
    return track.clone()
  } catch {
    return track
  }
}

function clonePreviewTrack(source: MediaStream | null): MediaStreamTrack | null {
  return cloneTrack(pickLiveVideoTrack(source))
}

function cloneAudioTrack(source: MediaStream | null): MediaStreamTrack | null {
  return cloneTrack(pickLiveAudioTrack(source))
}

function cloneOutboundTracks(source: MediaStream | null): MediaStreamTrack[] | null {
  const video = clonePreviewTrack(source)
  if (!video) return null

  const audio = cloneAudioTrack(source)
  return audio ? [video, audio] : [video]
}

async function openHostPeer(
  PeerCtor: typeof import('peerjs').default,
  hostId: string,
  rtcConfig: ReturnType<typeof boothPeerRtcConfig>,
  signal?: AbortSignal,
): Promise<Peer> {
  let lastError: unknown

  while (!signal?.aborted) {
    const peer = new PeerCtor(hostId, {
      debug: 0,
      config: rtcConfig,
    })

    try {
      await waitForPeerOpen(peer, signal)
      return peer
    } catch (error) {
      lastError = error
      peer.destroy()
      if (signal?.aborted) break
      await sleep(HOST_ID_RETRY_DELAY_MS, signal)
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Booth host peer is unavailable')
}

async function openGuestPeer(
  PeerCtor: typeof import('peerjs').default,
  rtcConfig: ReturnType<typeof boothPeerRtcConfig>,
  signal?: AbortSignal,
): Promise<Peer> {
  const peer = new PeerCtor({
    debug: 0,
    config: rtcConfig,
  })

  try {
    await waitForPeerOpen(peer, signal)
    return peer
  } catch (error) {
    peer.destroy()
    throw error
  }
}

function waitForPeerOpen(peer: Peer, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Booth WebRTC signaling aborted'))
      return
    }

    if (!peer.disconnected && peer.id) {
      resolve()
      return
    }

    const timer = globalThis.setTimeout(() => {
      cleanup()
      reject(new Error('Booth WebRTC signaling timed out'))
    }, PEER_OPEN_TIMEOUT_MS)

    const onOpen = () => {
      cleanup()
      resolve()
    }
    const onError = (error: unknown) => {
      cleanup()
      reject(error instanceof Error ? error : new Error('Booth WebRTC signaling failed'))
    }
    const onAbort = () => {
      cleanup()
      reject(new Error('Booth WebRTC signaling aborted'))
    }
    const cleanup = () => {
      globalThis.clearTimeout(timer)
      peer.off('open', onOpen)
      peer.off('error', onError)
      signal?.removeEventListener('abort', onAbort)
    }

    peer.on('open', onOpen)
    peer.on('error', onError)
    signal?.addEventListener('abort', onAbort)

    if (!peer.disconnected && peer.id) {
      cleanup()
      resolve()
    }
  })
}

function waitForConnectionOpen(connection: DataConnection, timeoutMs: number): Promise<void> {
  if (connection.open) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      cleanup()
      reject(new Error('Booth guest connect timed out'))
    }, timeoutMs)

    const onOpen = () => {
      cleanup()
      resolve()
    }
    const onError = (error: unknown) => {
      cleanup()
      reject(error instanceof Error ? error : new Error('Booth guest connect failed'))
    }
    const cleanup = () => {
      globalThis.clearTimeout(timer)
      connection.off('open', onOpen)
      connection.off('error', onError)
    }

    connection.on('open', onOpen)
    connection.on('error', onError)

    if (connection.open) {
      cleanup()
      resolve()
    }
  })
}

function isIgnorablePeerError(error: unknown): boolean {
  const type =
    error && typeof error === 'object' && 'type' in error
      ? String((error as { type?: string }).type)
      : ''
  return type === 'peer-unavailable' || type === 'network' || type === 'disconnected'
}

export function encodeBoothWirePayload(message: BoothWireMessage): BoothWireMessage | ArrayBuffer {
  if (message.type === 'still') return encodeFramedStill(message)
  if (message.type === 'background-asset') return encodeFramedBackgroundAsset(message)
  return message
}

export function decodeBoothWirePayload(data: unknown): BoothWireMessage | null {
  if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
    return decodeFramedPayload(toUint8Array(data))
  }

  if (!data || typeof data !== 'object') return null

  const message = data as BoothWireMessage
  if (!message.type) return null
  if (
    (message.type === 'still' ||
      message.type === 'start-moment' ||
      message.type === 'cancel-moment') &&
    (typeof message.captureId !== 'string' || !message.captureId)
  )
    return null

  if (message.type === 'still') {
    const record = data as { bytes?: unknown; bytesBase64?: unknown }
    const bytes =
      toArrayBuffer(record.bytes) ??
      (typeof record.bytesBase64 === 'string' ? base64ToArrayBuffer(record.bytesBase64) : null)
    if (!bytes) return null
    return { ...message, bytes }
  }

  if (message.type === 'background-asset') {
    const record = data as { bytes?: unknown; bytesBase64?: unknown }
    const bytes =
      toArrayBuffer(record.bytes) ??
      (typeof record.bytesBase64 === 'string' ? base64ToArrayBuffer(record.bytesBase64) : null)
    if (!bytes) return null
    return { ...message, bytes }
  }

  return message
}

function encodeFramedStill(message: Extract<BoothWireMessage, { type: 'still' }>): ArrayBuffer {
  const header = new TextEncoder().encode(
    JSON.stringify({
      type: 'still',
      captureId: message.captureId,
      momentIndex: message.momentIndex,
      peerId: message.peerId,
      role: message.role,
      mimeType: message.mimeType,
      width: message.width,
      height: message.height,
      revision: message.revision,
      faceBounds: message.faceBounds,
      cameraEffectFrameMs: message.cameraEffectFrameMs,
    }),
  )
  const payload = new Uint8Array(message.bytes)
  const frame = new Uint8Array(4 + header.byteLength + payload.byteLength)
  new DataView(frame.buffer).setUint32(0, header.byteLength)
  frame.set(header, 4)
  frame.set(payload, 4 + header.byteLength)
  return frame.buffer
}

function encodeFramedBackgroundAsset(
  message: Extract<BoothWireMessage, { type: 'background-asset' }>,
): ArrayBuffer {
  const header = new TextEncoder().encode(
    JSON.stringify({
      type: 'background-asset',
      assetId: message.assetId,
      revision: message.revision,
      hash: message.hash,
      mimeType: message.mimeType,
      peerId: message.peerId,
    }),
  )
  const payload = new Uint8Array(message.bytes)
  const frame = new Uint8Array(4 + header.byteLength + payload.byteLength)
  new DataView(frame.buffer).setUint32(0, header.byteLength)
  frame.set(header, 4)
  frame.set(payload, 4 + header.byteLength)
  return frame.buffer
}

function decodeFramedPayload(bytes: Uint8Array): BoothWireMessage | null {
  if (bytes.byteLength < 4) return null

  const headerLength = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0)
  if (headerLength <= 0 || 4 + headerLength > bytes.byteLength) return null

  try {
    const header = JSON.parse(new TextDecoder().decode(bytes.subarray(4, 4 + headerLength))) as {
      type?: string
      [key: string]: unknown
    }
    if (!header.type) return null

    const payload = bytes.subarray(4 + headerLength)
    const copy = new Uint8Array(payload.byteLength)
    copy.set(payload)

    if (header.type === 'still') {
      const stillHeader = header as Extract<BoothWireMessage, { type: 'still' }>
      if (typeof stillHeader.captureId !== 'string' || !stillHeader.captureId) return null
      return {
        type: 'still',
        captureId: stillHeader.captureId,
        momentIndex: stillHeader.momentIndex,
        peerId: stillHeader.peerId,
        role: stillHeader.role,
        mimeType: stillHeader.mimeType || 'image/png',
        width: stillHeader.width,
        height: stillHeader.height,
        bytes: copy.buffer,
        revision: stillHeader.revision,
        faceBounds: stillHeader.faceBounds?.map((face) => ({ ...face })),
        cameraEffectFrameMs: stillHeader.cameraEffectFrameMs,
      }
    }

    if (header.type === 'background-asset') {
      const assetHeader = header as Extract<BoothWireMessage, { type: 'background-asset' }>
      return {
        type: 'background-asset',
        assetId: assetHeader.assetId,
        revision: assetHeader.revision,
        hash: assetHeader.hash,
        mimeType: assetHeader.mimeType || 'image/jpeg',
        bytes: copy.buffer,
        peerId: assetHeader.peerId,
      }
    }

    return null
  } catch {
    return null
  }
}

function toUint8Array(value: ArrayBuffer | ArrayBufferView): Uint8Array {
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
}

function toArrayBuffer(value: unknown): ArrayBuffer | null {
  if (value instanceof ArrayBuffer) return value
  if (ArrayBuffer.isView(value)) {
    const copy = new Uint8Array(value.byteLength)
    copy.set(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))
    return copy.buffer
  }
  if (Array.isArray(value)) return new Uint8Array(value).buffer
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const keys = Object.keys(record)
    if (keys.length > 0 && keys.every((key) => /^\d+$/.test(key))) {
      const length = keys.reduce((max, key) => Math.max(max, Number(key) + 1), 0)
      const bytes = new Uint8Array(length)
      for (const key of keys) bytes[Number(key)] = Number(record[key])
      return bytes.buffer
    }
  }

  return null
}

function base64ToArrayBuffer(value: string): ArrayBuffer | null {
  if (typeof atob !== 'function') return null

  try {
    const binary = atob(value)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index++) {
      bytes[index] = binary.charCodeAt(index)
    }
    return bytes.buffer
  } catch {
    return null
  }
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new Error('Booth WebRTC signaling aborted')
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Booth WebRTC signaling aborted'))
      return
    }

    const timer = globalThis.setTimeout(resolve, ms)
    const onAbort = () => {
      globalThis.clearTimeout(timer)
      reject(new Error('Booth WebRTC signaling aborted'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
