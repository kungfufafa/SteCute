import { beforeAll, describe, expect, it } from 'vitest'
import {
  createBoothPeerSession,
  createDefaultBoothSetup,
  createInProcessTransportPair,
  type BoothWireMessage,
} from '@/services/booth'
import { encodeSolidPng } from '../png'
import { installSoftwareCanvas } from './software-canvas'

beforeAll(() => installSoftwareCanvas())

describe('changing an active Duet session setup', () => {
  it('locks settings after the first photo until the host explicitly resets both participants', async () => {
    const transports = createInProcessTransportPair()
    const sent: BoothWireMessage[] = []
    const sendHost = transports.host.send
    transports.host.send = (message) => {
      sent.push(message)
      sendHost(message)
    }
    const setup = createDefaultBoothSetup()
    const host = createBoothPeerSession({
      peerId: 'host',
      role: 'host',
      transport: transports.host,
      setup,
      slot: { width: 16, height: 8 },
    })
    const guest = createBoothPeerSession({
      peerId: 'guest',
      role: 'guest',
      transport: transports.guest,
      setup,
      slot: { width: 16, height: 8 },
    })
    const still = {
      blob: new Blob([encodeSolidPng(8, 8, [220, 24, 32, 255])], { type: 'image/png' }),
      width: 8,
      height: 8,
    }

    try {
      const updated = { ...setup, templateId: 'youth', countdownMs: 5000, autoCapture: true }
      await host.setSetup(updated)
      expect(guest.getSetup()).toMatchObject(updated)
      const captureId = host.startMoment(0)
      await Promise.all([
        host.submitStill(0, still, captureId),
        guest.submitStill(0, still, captureId),
      ])
      await Promise.all([host.waitForComposed(0), guest.waitForComposed(0)])
      const hostPhoto = host.getComposedByOrder()[0]?.shot
      const guestPhoto = guest.getComposedByOrder()[0]?.shot

      // Replaying unchanged settings remains available for connection/background recovery.
      await host.setSetup(updated)
      for (const change of [
        { templateId: 'classic' },
        { countdownMs: 10000 },
        { autoCapture: false },
        { layoutId: 'strip-2-vertical', slotCount: 2 },
      ]) {
        await expect(host.setSetup({ ...updated, ...change })).rejects.toThrow('locked')
      }
      // Even a delayed or invalid peer setup must not change an already captured strip.
      transports.host.send({
        type: 'session-setup',
        ...updated,
        layoutId: 'strip-2-vertical',
        slotCount: 2,
        nonce: 'unexpected-layout-change',
      })
      expect(host.getSetup()).toMatchObject(updated)
      expect(guest.getSetup()).toMatchObject(updated)
      expect(host.getComposedByOrder()[0]?.shot).toBe(hostPhoto)
      expect(guest.getComposedByOrder()[0]?.shot).toBe(guestPhoto)
      await expect(guest.setSetup(setup)).rejects.toThrow('Only the booth host')

      const resets = [host.waitForReset(), guest.waitForReset()]
      host.resetCapture()
      await Promise.all(resets)
      expect(sent.filter((message) => message.type === 'session-reset')).toHaveLength(1)
      await host.setSetup({ ...updated, layoutId: 'strip-2-vertical', slotCount: 2 })
      for (const session of [host, guest]) {
        expect(session.getSetup()?.slotCount).toBe(2)
        expect(session.getComposedByOrder()).toEqual([])
        expect(session.isCaptureActive(0, captureId)).toBe(false)
      }

      // Previously captured frames cannot repopulate the restarted layout.
      for (const message of sent.filter((message) => message.type === 'still')) {
        transports.host.send(message)
      }
      expect(guest.getComposedByOrder()).toEqual([])
      const nextCapture = host.startMoment(0)
      expect(nextCapture).not.toBe(captureId)
      await expect(host.setSetup(updated)).rejects.toThrow('locked')
      await Promise.all([
        host.submitStill(0, still, nextCapture),
        guest.submitStill(0, still, nextCapture),
      ])
      await Promise.all([host.waitForComposed(0), guest.waitForComposed(0)])
      expect(host.getComposedByOrder()).toHaveLength(1)
      expect(guest.getComposedByOrder()).toHaveLength(1)
    } finally {
      host.dispose()
      guest.dispose()
    }
  })
})
