import { describe, expect, it } from 'vitest'
import { decodeBoothWirePayload, encodeBoothWirePayload } from '@/services/booth/webrtc'
import type { BoothWireMessage } from '@/services/booth/transport'

describe('booth WebRTC still codec', () => {
  it('rejects capture payloads without an attempt ID', () => {
    expect(
      decodeBoothWirePayload({ type: 'start-moment', momentIndex: 0, countdownMs: 3000 }),
    ).toBeNull()
    expect(
      decodeBoothWirePayload({ type: 'still', momentIndex: 0, bytes: new Uint8Array([1]).buffer }),
    ).toBeNull()
    const frame = encodeBoothWirePayload({
      type: 'still',
      captureId: '',
      momentIndex: 0,
      peerId: 'guest',
      role: 'guest',
      mimeType: 'image/png',
      width: 1,
      height: 1,
      bytes: new Uint8Array([1]).buffer,
    })
    expect(decodeBoothWirePayload(frame)).toBeNull()
  })
  it('round-trips a still through a framed ArrayBuffer', () => {
    const bytes = new Uint8Array([10, 20, 30, 40]).buffer
    const message: BoothWireMessage = {
      type: 'still',
      captureId: 'capture-1',
      momentIndex: 1,
      peerId: 'guest-1',
      role: 'guest',
      mimeType: 'image/jpeg',
      width: 8,
      height: 6,
      bytes,
      faceBounds: [{ x: 0.2, y: 0.1, width: 0.3, height: 0.4 }],
      cameraEffectFrameMs: 90,
    }

    const encoded = encodeBoothWirePayload(message)
    expect(encoded).toBeInstanceOf(ArrayBuffer)

    const decoded = decodeBoothWirePayload(encoded)
    expect(decoded).toMatchObject({
      type: 'still',
      captureId: 'capture-1',
      momentIndex: 1,
      peerId: 'guest-1',
      role: 'guest',
      mimeType: 'image/jpeg',
      width: 8,
      height: 6,
      faceBounds: [{ x: 0.2, y: 0.1, width: 0.3, height: 0.4 }],
      cameraEffectFrameMs: 90,
    })
    expect(decoded?.type === 'still' && [...new Uint8Array(decoded.bytes)]).toEqual([
      10, 20, 30, 40,
    ])
  })

  it('accepts a JSON-shaped numeric byte object from a serialized still', () => {
    const decoded = decodeBoothWirePayload({
      type: 'still',
      captureId: 'capture-1',
      momentIndex: 0,
      peerId: 'host-1',
      role: 'host',
      mimeType: 'image/png',
      width: 2,
      height: 2,
      bytes: { 0: 1, 1: 2, 2: 3, 3: 4 },
    })

    expect(decoded?.type).toBe('still')
    expect(decoded?.type === 'still' && [...new Uint8Array(decoded.bytes)]).toEqual([1, 2, 3, 4])
  })
})
