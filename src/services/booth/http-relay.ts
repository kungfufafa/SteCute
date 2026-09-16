import { sealBoothMessage, unsealBoothMessage } from './seal'
import type { BoothTransport, BoothWireMessage } from './transport'

const POLL_MS = 400
const PROBE_TIMEOUT_MS = 2_500

export async function createHttpBoothTransport(
  normalizedCode: string,
  signal?: AbortSignal,
): Promise<BoothTransport | null> {
  if (typeof fetch !== 'function') return null

  const url = boothRelayUrl(normalizedCode)
  const available = await probeBoothRelay(url, signal)
  if (!available) return null

  const handlers = new Set<(message: BoothWireMessage) => void>()
  let cursor = ''
  let disposed = false

  const onAbort = () => {
    disposed = true
  }
  signal?.addEventListener('abort', onAbort)

  void poll()

  async function poll() {
    while (!disposed && !signal?.aborted) {
      try {
        const response = await fetch(`${url}?after=${encodeURIComponent(cursor)}`, { signal })
        if (response.ok) {
          const body = (await response.json()) as {
            messages?: Array<{ id: string; payload: unknown }>
          }
          for (const entry of body.messages ?? []) {
            cursor = entry.id
            const message = await unsealBoothMessage(normalizedCode, entry.payload)
            if (!message || disposed) continue
            for (const handler of handlers) handler(message)
          }
        }
      } catch {
        if (disposed || signal?.aborted) return
      }

      await sleep(POLL_MS, signal)
    }
  }

  return {
    send(message) {
      if (disposed || signal?.aborted) return
      void (async () => {
        try {
          const payload = await sealBoothMessage(normalizedCode, message)
          await fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ payload }),
            signal,
          })
        } catch {
          // Polling retries presence; a dropped still surfaces as compose timeout.
        }
      })()
    },
    subscribe(handler) {
      handlers.add(handler)
      return () => handlers.delete(handler)
    },
    dispose() {
      disposed = true
      signal?.removeEventListener('abort', onAbort)
      handlers.clear()
    },
  }
}

export function boothRelayUrl(normalizedCode: string): string {
  return `/api/booth-relay/${encodeURIComponent(normalizedCode)}`
}

async function probeBoothRelay(url: string, signal?: AbortSignal): Promise<boolean> {
  const probe = new AbortController()
  const timer = globalThis.setTimeout(() => probe.abort(), PROBE_TIMEOUT_MS)
  const onParentAbort = () => probe.abort()
  signal?.addEventListener('abort', onParentAbort, { once: true })

  try {
    const response = await fetch(url, { method: 'GET', signal: probe.signal })
    return response.ok
  } catch {
    return false
  } finally {
    globalThis.clearTimeout(timer)
    signal?.removeEventListener('abort', onParentAbort)
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve()
      return
    }
    const timer = globalThis.setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        globalThis.clearTimeout(timer)
        resolve()
      },
      { once: true },
    )
  })
}
