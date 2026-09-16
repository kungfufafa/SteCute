import { createHttpBoothTransport } from './http-relay'
import { createWebRtcBoothTransport } from './webrtc'
import {
  boothChannelName,
  createBroadcastBoothTransport,
  createFanoutBoothTransport,
  type BoothPeerRole,
  type BoothTransport,
} from './transport'

const WEBRTC_RETRY_DELAY_MS = 1_500

export async function createBoothRoomTransport(
  normalizedCode: string,
  role: BoothPeerRole,
): Promise<BoothTransport> {
  const fanout = createFanoutBoothTransport()
  let disposed = false
  const abort = new AbortController()
  const originalDispose = fanout.dispose
  fanout.dispose = () => {
    disposed = true
    abort.abort()
    originalDispose?.()
  }

  const http = await createHttpBoothTransport(normalizedCode, abort.signal)
  if (http) fanout.add(http)

  if (typeof BroadcastChannel !== 'undefined') {
    fanout.add(createBroadcastBoothTransport(boothChannelName(normalizedCode)))
  }

  if (http || typeof BroadcastChannel !== 'undefined') {
    void attachWebRtc(normalizedCode, role, fanout, () => disposed, abort.signal)
    return fanout
  }

  fanout.add(await createWebRtcBoothTransport(normalizedCode, role, abort.signal))
  return fanout
}

async function attachWebRtc(
  normalizedCode: string,
  role: BoothPeerRole,
  fanout: ReturnType<typeof createFanoutBoothTransport>,
  isDisposed: () => boolean,
  signal: AbortSignal,
) {
  while (!isDisposed() && !signal.aborted) {
    try {
      const transport = await createWebRtcBoothTransport(normalizedCode, role, signal)
      if (isDisposed()) {
        transport.dispose?.()
        return
      }
      fanout.add(transport)
      return
    } catch (error) {
      if (isDisposed() || signal.aborted) return
      console.warn('Booth WebRTC unavailable; retrying signaling.', error)
      await sleep(WEBRTC_RETRY_DELAY_MS, signal)
    }
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve()
      return
    }

    const timer = globalThis.setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        globalThis.clearTimeout(timer)
        resolve()
      },
      { once: true },
    )
  })
}
