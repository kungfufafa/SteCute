import { decodeBoothWirePayload, encodeBoothWirePayload } from './webrtc'
import type { BoothWireMessage } from './transport'

const SEAL_INFO = 'stecute.booth.v1'

export type SealedBoothPayload = {
  v: 1
  iv: string
  data: string
}

export async function sealBoothMessage(
  normalizedCode: string,
  message: BoothWireMessage,
): Promise<SealedBoothPayload> {
  const encoded = encodeBoothWirePayload(message)
  const json = JSON.stringify(serializableWire(encoded === message ? message : encoded, message))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await boothSealKey(normalizedCode)
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(json),
  )
  return {
    v: 1,
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(data)),
  }
}

export async function unsealBoothMessage(
  normalizedCode: string,
  payload: unknown,
): Promise<BoothWireMessage | null> {
  if (!isSealedPayload(payload)) {
    return decodeBoothWirePayload(payload)
  }

  try {
    const key = await boothSealKey(normalizedCode)
    const iv = asArrayBuffer(base64ToBytes(payload.iv))
    const data = asArrayBuffer(base64ToBytes(payload.data))
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
    const parsed = JSON.parse(new TextDecoder().decode(plain)) as {
      type?: string
      bytesBase64?: string
    }
    if (parsed?.type === 'still-frame' && typeof parsed.bytesBase64 === 'string') {
      return decodeBoothWirePayload(asArrayBuffer(base64ToBytes(parsed.bytesBase64)))
    }
    return decodeBoothWirePayload(parsed)
  } catch {
    return null
  }
}

async function boothSealKey(normalizedCode: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${SEAL_INFO}:${normalizedCode}`),
  )
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

function serializableWire(
  encoded: BoothWireMessage | ArrayBuffer,
  original: BoothWireMessage,
): unknown {
  if (encoded instanceof ArrayBuffer) {
    return {
      type: 'still-frame',
      bytesBase64: bytesToBase64(new Uint8Array(encoded)),
    }
  }
  if (original.type !== 'still') return original
  return {
    ...original,
    bytes: undefined,
    bytesBase64: bytesToBase64(new Uint8Array(original.bytes)),
  }
}

function isSealedPayload(value: unknown): value is SealedBoothPayload {
  if (!value || typeof value !== 'object') return false
  const record = value as SealedBoothPayload
  return record.v === 1 && typeof record.iv === 'string' && typeof record.data === 'string'
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes
}
