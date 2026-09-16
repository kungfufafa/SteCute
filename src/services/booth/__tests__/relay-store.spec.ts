import { describe, expect, it } from 'vitest'
import {
  appendBoothRelayMessage,
  handleBoothRelay,
  listBoothRelayMessages,
} from '../../../../server/booth-relay.mjs'

describe('booth HTTPS mailbox', () => {
  it('stores and lists sealed payloads by booth code', () => {
    const code = 'AB23CD'
    const id = appendBoothRelayMessage(code, { v: 1, data: 'sealed' })
    const listed = listBoothRelayMessages(code, '')
    expect(listed.some((entry) => entry.id === id)).toBe(true)

    const next = handleBoothRelay({
      method: 'POST',
      pathname: `/api/booth-relay/${code}`,
      searchParams: new URLSearchParams(),
      bodyText: JSON.stringify({ payload: { v: 1, data: 'hello' } }),
    })
    expect(next.status).toBe(201)

    const read = handleBoothRelay({
      method: 'GET',
      pathname: `/api/booth-relay/${code}`,
      searchParams: new URLSearchParams(`after=${id}`),
    })
    expect(read.status).toBe(200)
    expect(read.json).toEqual({
      messages: [expect.objectContaining({ payload: { v: 1, data: 'hello' } })],
    })
  })

  it('rejects unknown codes', () => {
    expect(
      handleBoothRelay({
        method: 'GET',
        pathname: '/api/booth-relay/@@@',
        searchParams: new URLSearchParams(),
      }).status,
    ).toBe(404)
  })
})
