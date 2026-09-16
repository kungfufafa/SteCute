import type { DataConnection, Peer } from 'peerjs'
import { boothPeerRtcConfig, getBoothIceServers } from './ice'
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
  let disposed = false
  const hostId = boothHostPeerId(normalizedCode)
  const iceServers = await getBoothIceServers(signal)
  const rtcConfig = boothPeerRtcConfig(iceServers)
  const peer =
    role === 'host'
      ? await openHostPeer(Peer, hostId, rtcConfig, signal)
      : await openGuestPeer(Peer, rtcConfig, signal)

  const onAbort = () => {
    if (!disposed) {
      disposed = true
      peer.destroy()
    }
  }
  signal?.addEventListener('abort', onAbort)

  peer.on('connection', (connection) => attachConnection(connection))
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
    dispose() {
      disposed = true
      signal?.removeEventListener('abort', onAbort)
      for (const connection of connections) connection.close()
      connections.clear()
      handlers.clear()
      peer.destroy()
    },
  }
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
  if (message.type !== 'still') return message
  return encodeFramedStill(message)
}

export function decodeBoothWirePayload(data: unknown): BoothWireMessage | null {
  if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
    return decodeFramedStill(toUint8Array(data))
  }

  if (!data || typeof data !== 'object') return null

  const message = data as BoothWireMessage
  if (!message.type) return null

  if (message.type === 'still') {
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
      momentIndex: message.momentIndex,
      peerId: message.peerId,
      role: message.role,
      mimeType: message.mimeType,
      width: message.width,
      height: message.height,
    }),
  )
  const payload = new Uint8Array(message.bytes)
  const frame = new Uint8Array(4 + header.byteLength + payload.byteLength)
  new DataView(frame.buffer).setUint32(0, header.byteLength)
  frame.set(header, 4)
  frame.set(payload, 4 + header.byteLength)
  return frame.buffer
}

function decodeFramedStill(bytes: Uint8Array): BoothWireMessage | null {
  if (bytes.byteLength < 4) return null

  const headerLength = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0)
  if (headerLength <= 0 || 4 + headerLength > bytes.byteLength) return null

  try {
    const header = JSON.parse(
      new TextDecoder().decode(bytes.subarray(4, 4 + headerLength)),
    ) as Extract<BoothWireMessage, { type: 'still' }>
    if (header.type !== 'still') return null

    const payload = bytes.subarray(4 + headerLength)
    const copy = new Uint8Array(payload.byteLength)
    copy.set(payload)

    return {
      type: 'still',
      momentIndex: header.momentIndex,
      peerId: header.peerId,
      role: header.role,
      mimeType: header.mimeType || 'image/png',
      width: header.width,
      height: header.height,
      bytes: copy.buffer,
    }
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
