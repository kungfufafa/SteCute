import { describe, expect, it } from 'vitest'
import { sealBoothMessage, unsealBoothMessage } from '../seal'
import type { BoothWireMessage } from '../transport'

describe('booth relay seal', () => {
  it('round-trips hello and still payloads that the mailbox cannot read as photos', async () => {
    const hello: BoothWireMessage = { type: 'hello', peerId: 'host-1', role: 'host' }
    const still: BoothWireMessage = {
      type: 'still',
      momentIndex: 0,
      peerId: 'guest-1',
      role: 'guest',
      mimeType: 'image/png',
      width: 2,
      height: 2,
      bytes: new Uint8Array([1, 2, 3, 4]).buffer,
    }

    const sealedHello = await sealBoothMessage('ABC234', hello)
    const sealedStill = await sealBoothMessage('ABC234', still)

    expect(JSON.stringify(sealedHello)).not.toContain('host-1')
    expect(JSON.stringify(sealedStill)).not.toContain('guest-1')

    await expect(unsealBoothMessage('ABC234', sealedHello)).resolves.toEqual(hello)

    const opened = await unsealBoothMessage('ABC234', sealedStill)
    expect(opened?.type).toBe('still')
    expect(opened?.type === 'still' && [...new Uint8Array(opened.bytes)]).toEqual([1, 2, 3, 4])

    await expect(unsealBoothMessage('OTHER1', sealedHello)).resolves.toBeNull()
  })
})
