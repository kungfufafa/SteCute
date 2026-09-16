import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHttpBoothTransport } from '../http-relay'
import { sealBoothMessage } from '../seal'
import type { BoothWireMessage } from '../transport'

const hello: BoothWireMessage = { type: 'hello', peerId: 'host-1', role: 'host' }

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('booth HTTPS relay transport', () => {
  it('delivers a sealed hello from the same-origin mailbox', async () => {
    const sealed = await sealBoothMessage('ABC234', hello)
    let delivered = false
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'POST') {
        return new Response(JSON.stringify({ id: '2' }), { status: 201 })
      }
      if (url.includes('after=') && !delivered) {
        delivered = true
        return new Response(JSON.stringify({ messages: [{ id: '1', payload: sealed }] }), {
          status: 200,
        })
      }
      return new Response(JSON.stringify({ messages: [] }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const received: BoothWireMessage[] = []
    const transport = await createHttpBoothTransport('ABC234')
    expect(transport).not.toBeNull()
    transport?.subscribe((message) => received.push(message))

    await vi.waitFor(() => {
      expect(received).toEqual([hello])
    })

    transport?.send({ type: 'welcome', peerId: 'guest-1', role: 'guest' })
    await vi.waitFor(() => {
      expect(fetchMock.mock.calls.some((call) => call[1]?.method === 'POST')).toBe(true)
    })

    transport?.dispose()
  })

  it('skips the mailbox when the origin has no relay endpoint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('missing', { status: 404 })),
    )
    await expect(createHttpBoothTransport('ABC234')).resolves.toBeNull()
  })
})
