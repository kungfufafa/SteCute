import { beforeAll, describe, expect, it } from 'vitest'
import type { LayoutConfig, Shot } from '@/db/schema'
import { createDefaultDecorationConfig } from '@/services/session'
import { renderStrip } from '@/services/render'
import { classicTemplate } from '@/templates/classic/config'
import {
  composePairRow,
  createBoothPeerSession,
  createInProcessTransportPair,
  type BoothStill,
  type BoothWireMessage,
} from '@/services/booth'
import { decodePng, encodeSolidPng, type RgbaImage } from '../png'
import { installSoftwareCanvas } from './software-canvas'

const PAIR_SLOT = { width: 16, height: 8 }

const testLayout: LayoutConfig = {
  id: 'strip-2-vertical',
  name: '2 Foto',
  slotCount: 2,
  printFormat: {
    id: 'fit-2-photo-strip',
    label: '2 Foto',
    paperSize: 'Fit 2 foto',
    description: 'Kertas pendek',
    fileSlug: 'fit-2-photo-strip',
  },
  canvas: { width: 40, height: 56 },
  slots: [
    { x: 4, y: 4, width: 32, height: 16, radius: 0 },
    { x: 4, y: 24, width: 32, height: 16, radius: 0 },
  ],
}

beforeAll(() => {
  installSoftwareCanvas()
})

describe('booth two-peer capture protocol', () => {
  it('rejects delayed stills and duplicate starts from an earlier retake attempt', async () => {
    const transports = createInProcessTransportPair()
    const sent: BoothWireMessage[] = []
    for (const transport of [transports.host, transports.guest]) {
      const send = transport.send
      transport.send = (message) => {
        sent.push(message)
        send(message)
      }
    }
    const host = createBoothPeerSession({
      peerId: 'host',
      role: 'host',
      transport: transports.host,
      slot: PAIR_SLOT,
    })
    const guest = createBoothPeerSession({
      peerId: 'guest',
      role: 'guest',
      transport: transports.guest,
      slot: PAIR_SLOT,
    })
    const firstId = host.startMoment(0)
    await Promise.all([
      host.submitStill(0, stillFromColor([220, 24, 32, 255])),
      guest.submitStill(0, stillFromColor([32, 64, 220, 255])),
    ])
    await host.waitForComposed(0)
    const oldMessages = sent.filter(
      (message) =>
        (message.type === 'still' || message.type === 'start-moment') &&
        message.captureId === firstId,
    )
    const secondId = host.startMoment(0)
    for (const message of oldMessages) {
      if (message.type === 'still' && message.peerId === 'guest') transports.guest.send(message)
      else transports.host.send(message)
    }
    expect(host.isCaptureActive(0, secondId)).toBe(true)
    expect(guest.isCaptureActive(0, secondId)).toBe(true)
    await Promise.all([
      host.submitStill(0, stillFromColor([16, 200, 64, 255]), secondId),
      guest.submitStill(0, stillFromColor([240, 200, 32, 255]), secondId),
    ])
    for (const session of [host, guest]) {
      const image = await readPng((await session.waitForComposed(0)).blob)
      expect(pixelAt(image, 1, 4)).toEqual([16, 200, 64, 255])
      expect(pixelAt(image, 14, 4)).toEqual([240, 200, 32, 255])
      session.dispose()
    }
  })

  it('cancels waiters and excludes late stills and cancellation from a new attempt', async () => {
    const transports = createInProcessTransportPair()
    const host = createBoothPeerSession({
      peerId: 'host',
      role: 'host',
      transport: transports.host,
      slot: PAIR_SLOT,
    })
    const guest = createBoothPeerSession({
      peerId: 'guest',
      role: 'guest',
      transport: transports.guest,
      slot: PAIR_SLOT,
    })
    const firstId = host.startMoment(0)
    await host.submitStill(0, stillFromColor([220, 24, 32, 255]), firstId)
    const cancelled = expect(host.waitForComposed(0, 1000, firstId)).rejects.toThrow('cancelled')
    host.cancelMoment(undefined, 'cancelled')
    await cancelled
    const nextId = host.startMoment(0)
    transports.host.send({ type: 'cancel-moment', nonce: 'legacy-global' } as BoothWireMessage)
    transports.host.send({
      type: 'cancel-moment',
      momentIndex: 0,
      captureId: firstId,
      reason: 'cancelled',
      nonce: 'delayed-cancel',
    })
    await expect(guest.submitStill(0, stillFromColor([32, 64, 220, 255]), firstId)).rejects.toThrow(
      'no longer active',
    )
    expect(guest.isCaptureActive(0, nextId)).toBe(true)
    await Promise.all([
      host.submitStill(0, stillFromColor([16, 200, 64, 255]), nextId),
      guest.submitStill(0, stillFromColor([240, 200, 32, 255]), nextId),
    ])
    expect(host.getComposedShots()).toHaveLength(1)
    host.dispose()
    guest.dispose()
  })

  it('keeps camera readiness distinct from presence and clears readiness on departure', () => {
    const transports = createInProcessTransportPair()
    const host = createBoothPeerSession({
      peerId: 'host',
      role: 'host',
      transport: transports.host,
    })
    const guest = createBoothPeerSession({
      peerId: 'guest',
      role: 'guest',
      transport: transports.guest,
    })
    expect(host.getRemotePeerId()).toBe('guest')
    expect(host.getRemoteCameraReady()).toBe(false)
    guest.setCameraReady(true)
    expect(host.getRemoteCameraReady()).toBe(true)
    guest.setCameraReady(false)
    expect(host.getRemoteCameraReady()).toBe(false)
    guest.setCameraReady(true)
    guest.dispose()
    expect(host.getRemoteCameraReady()).toBe(false)
    host.dispose()
  })

  it('does not send a local still that finishes encoding after cancellation', async () => {
    const transports = createInProcessTransportPair()
    const sent: BoothWireMessage[] = []
    const send = transports.host.send
    transports.host.send = (message) => {
      sent.push(message)
      send(message)
    }
    const host = createBoothPeerSession({
      peerId: 'host',
      role: 'host',
      transport: transports.host,
      slot: PAIR_SLOT,
    })
    const guest = createBoothPeerSession({
      peerId: 'guest',
      role: 'guest',
      transport: transports.guest,
      slot: PAIR_SLOT,
    })
    const still = stillFromColor([220, 24, 32, 255])
    const bytes = await still.blob.arrayBuffer()
    let finishEncoding!: (buffer: ArrayBuffer) => void
    still.blob.arrayBuffer = () =>
      new Promise((resolve) => {
        finishEncoding = resolve
      })
    const oldId = host.startMoment(0)
    const pending = expect(host.submitStill(0, still, oldId)).rejects.toThrow('no longer active')
    host.cancelMoment(0)
    const nextId = host.startMoment(0)
    finishEncoding(bytes)
    await pending
    expect(sent.some((message) => message.type === 'still' && message.captureId === oldId)).toBe(
      false,
    )
    expect(host.isCaptureActive(0, nextId)).toBe(true)
    host.dispose()
    guest.dispose()
  })

  it('runs a shared countdown, composes pair-row stills, and renders a PNG strip', async () => {
    const hostStill = stillFromColor([220, 24, 32, 255])
    const guestStill = stillFromColor([32, 64, 220, 255])
    const { host: hostTransport, guest: guestTransport } = createInProcessTransportPair()
    const host = createBoothPeerSession({
      peerId: 'host-peer',
      role: 'host',
      transport: hostTransport,
      slot: PAIR_SLOT,
    })
    const guest = createBoothPeerSession({
      peerId: 'guest-peer',
      role: 'guest',
      transport: guestTransport,
      slot: PAIR_SLOT,
    })

    const guestCountdown = guest.waitForCountdown(0)
    host.startMoment(0, 3000)
    await expect(host.waitForCountdown(0)).resolves.toBe(3000)
    await expect(guestCountdown).resolves.toBe(3000)

    await Promise.all([host.submitStill(0, hostStill), guest.submitStill(0, guestStill)])
    const composed = await host.waitForComposed(0)
    const guestComposed = await guest.waitForComposed(0)

    expect(composed.width).toBe(PAIR_SLOT.width)
    expect(composed.height).toBe(PAIR_SLOT.height)
    expect(composed.blob.size).toBeGreaterThan(0)
    expect(composed.blob.type).toBe('image/png')
    expect(guestComposed.blob.size).toBeGreaterThan(0)

    const swapped = await composePairRow(guestStill, hostStill, PAIR_SLOT)
    const composedPixels = await readPng(composed.blob)
    const swappedPixels = await readPng(swapped.blob)

    expect(composedPixels.width).toBe(PAIR_SLOT.width)
    expect(composedPixels.height).toBe(PAIR_SLOT.height)
    expect(pixelsEqual(composedPixels, swappedPixels)).toBe(false)
    expect(pixelAt(composedPixels, 1, 4)).not.toEqual(pixelAt(composedPixels, 14, 4))
    expect(pixelAt(composedPixels, 1, 4)).toEqual(pixelAt(swappedPixels, 14, 4))

    host.startMoment(1)
    await Promise.all([host.submitStill(1, hostStill), guest.submitStill(1, guestStill)])
    const second = await host.waitForComposed(1)

    const shots: Shot[] = [composed, second].map((shot, order) => ({
      id: `booth-shot-${order}`,
      sessionId: 'booth-protocol',
      order,
      sourceType: 'camera',
      blob: shot.blob,
      width: shot.width,
      height: shot.height,
      createdAt: Date.now(),
    }))

    const rendered = await renderStrip({
      layout: testLayout,
      template: classicTemplate,
      shots,
      decoration: createDefaultDecorationConfig(),
      format: 'image/png',
    })

    expect(rendered.blob.size).toBeGreaterThan(0)
    expect(rendered.blob.type).toBe('image/png')
    expect(rendered.width).toBe(testLayout.canvas.width)
    expect(rendered.height).toBe(testLayout.canvas.height)

    host.dispose()
    guest.dispose()
  })

  it('rejects a third peer after two people are already in the booth', async () => {
    const listeners: Array<Set<(message: { type: string; peerId?: string }) => void>> = [
      new Set(),
      new Set(),
      new Set(),
    ]
    const transports = listeners.map((own, index) => ({
      send(message: { type: string; peerId?: string }) {
        listeners.forEach((set, listenerIndex) => {
          if (listenerIndex === index) return
          for (const handler of set) handler({ ...message })
        })
      },
      subscribe(handler: (message: { type: string; peerId?: string }) => void) {
        own.add(handler)
        return () => own.delete(handler)
      },
    }))

    const host = createBoothPeerSession({
      peerId: 'host-peer',
      role: 'host',
      transport: transports[0] as never,
    })
    const guest = createBoothPeerSession({
      peerId: 'guest-peer',
      role: 'guest',
      transport: transports[1] as never,
    })
    const extra = createBoothPeerSession({
      peerId: 'extra-peer',
      role: 'guest',
      transport: transports[2] as never,
    })

    expect(host.getRemotePeerId()).toBe('guest-peer')
    expect(guest.getRemotePeerId()).toBe('host-peer')
    expect(guest.getRejectedReason()).toBeNull()
    expect(extra.getRejectedReason()).toBe('full')

    host.dispose()
    guest.dispose()
    extra.dispose()
  })

  it('stores stills by handshake role instead of the sender-chosen role', async () => {
    const hostStill = stillFromColor([220, 24, 32, 255])
    const guestStill = stillFromColor([32, 64, 220, 255])
    const { host: hostTransport, guest: guestTransport } = createInProcessTransportPair()
    const host = createBoothPeerSession({
      peerId: 'host-peer',
      role: 'host',
      transport: hostTransport,
      slot: PAIR_SLOT,
    })
    const guest = createBoothPeerSession({
      peerId: 'guest-peer',
      role: 'guest',
      transport: guestTransport,
      slot: PAIR_SLOT,
    })

    const captureId = host.startMoment(0)
    await host.submitStill(0, hostStill)
    guestTransport.send({
      type: 'still',
      captureId,
      momentIndex: 0,
      peerId: 'guest-peer',
      role: 'host',
      mimeType: 'image/png',
      width: guestStill.width,
      height: guestStill.height,
      bytes: await guestStill.blob.arrayBuffer(),
    })

    const composed = await host.waitForComposed(0, 5_000)
    const composedPixels = await readPng(composed.blob)
    expect(pixelAt(composedPixels, 1, 4)).toEqual([220, 24, 32, 255])
    expect(pixelAt(composedPixels, 14, 4)).toEqual([32, 64, 220, 255])

    host.dispose()
    guest.dispose()
  })

  it('replays a pose when the host starts the same moment again', async () => {
    const { host: hostTransport, guest: guestTransport } = createInProcessTransportPair()
    const host = createBoothPeerSession({
      peerId: 'host-peer',
      role: 'host',
      transport: hostTransport,
    })
    const guest = createBoothPeerSession({
      peerId: 'guest-peer',
      role: 'guest',
      transport: guestTransport,
    })

    const first = guest.waitForStart()
    host.startMoment(0, 3000)
    await expect(first).resolves.toEqual({
      momentIndex: 0,
      countdownMs: 3000,
      captureId: expect.any(String),
    })

    const second = guest.waitForStart()
    host.startMoment(0, 2500)
    await expect(second).resolves.toEqual({
      momentIndex: 0,
      countdownMs: 2500,
      captureId: expect.any(String),
    })

    host.dispose()
    guest.dispose()
  })

  it('rejects pending countdown waiters when the booth is disposed', async () => {
    const { host: hostTransport } = createInProcessTransportPair()
    const host = createBoothPeerSession({
      peerId: 'host-peer',
      role: 'host',
      transport: hostTransport,
    })

    const pending = host.waitForCountdown(0)
    host.dispose()
    await expect(pending).rejects.toThrow('Booth session disposed')
  })

  it('ignores duplicate start-moment deliveries from two transports', async () => {
    const handlers = new Set<
      (message: {
        type: string
        nonce?: string
        momentIndex?: number
        countdownMs?: number
      }) => void
    >()
    const transport = {
      send() {},
      subscribe(
        handler: (message: {
          type: string
          nonce?: string
          momentIndex?: number
          countdownMs?: number
        }) => void,
      ) {
        handlers.add(handler)
        return () => handlers.delete(handler)
      },
    }
    const guest = createBoothPeerSession({
      peerId: 'guest-peer',
      role: 'guest',
      transport: transport as never,
    })

    const first = guest.waitForStart()
    const duplicate = {
      type: 'start-moment' as const,
      captureId: 'same-start',
      momentIndex: 0,
      countdownMs: 3000,
      nonce: 'same-start',
    }
    for (const handler of handlers) {
      handler(duplicate)
      handler(duplicate)
    }

    await expect(first).resolves.toEqual({
      momentIndex: 0,
      countdownMs: 3000,
      captureId: expect.any(String),
    })

    const second = guest.waitForStart()
    const raced = await Promise.race([
      second.then(() => 'start'),
      new Promise((resolve) => globalThis.setTimeout(() => resolve('timeout'), 40)),
    ])
    expect(raced).toBe('timeout')

    guest.dispose()
    await expect(second).rejects.toThrow('Booth session disposed')
  })

  it('does not restart a pose when the host transport echoes the same start-moment', async () => {
    const handlers = new Set<(message: BoothWireMessage) => void>()
    const transport = {
      send(message: BoothWireMessage) {
        for (const handler of handlers) handler({ ...message })
      },
      subscribe(handler: (message: BoothWireMessage) => void) {
        handlers.add(handler)
        return () => handlers.delete(handler)
      },
    }
    const host = createBoothPeerSession({
      peerId: 'host-peer',
      role: 'host',
      transport,
    })

    const first = host.waitForStart()
    host.startMoment(0, 3000)
    await expect(first).resolves.toEqual({
      momentIndex: 0,
      countdownMs: 3000,
      captureId: expect.any(String),
    })

    const second = host.waitForStart()
    const raced = await Promise.race([
      second.then(() => 'start'),
      new Promise((resolve) => globalThis.setTimeout(() => resolve('timeout'), 40)),
    ])
    expect(raced).toBe('timeout')

    host.dispose()
    await expect(second).rejects.toThrow('Booth session disposed')
  })

  it('does not enqueue a second countdown after a pose is already composed', async () => {
    const hostStill = stillFromColor([220, 24, 32, 255])
    const guestStill = stillFromColor([32, 64, 220, 255])
    const { host: hostTransport, guest: guestTransport } = createInProcessTransportPair()
    const host = createBoothPeerSession({
      peerId: 'host-peer',
      role: 'host',
      transport: hostTransport,
      slot: PAIR_SLOT,
    })
    const guest = createBoothPeerSession({
      peerId: 'guest-peer',
      role: 'guest',
      transport: guestTransport,
      slot: PAIR_SLOT,
    })

    const first = guest.waitForStart()
    host.startMoment(0, 3000)
    const { captureId } = await first
    await Promise.all([host.submitStill(0, hostStill), guest.submitStill(0, guestStill)])
    await guest.waitForComposed(0)

    const second = guest.waitForStart()
    guestTransport.send({
      type: 'start-moment',
      captureId,
      momentIndex: 0,
      countdownMs: 3000,
      nonce: 'host-peer:1',
    })
    const raced = await Promise.race([
      second.then(() => 'start'),
      new Promise((resolve) => globalThis.setTimeout(() => resolve('timeout'), 40)),
    ])
    expect(raced).toBe('timeout')
    expect(guest.getComposedByOrder()).toHaveLength(1)

    host.dispose()
    guest.dispose()
    await expect(second).rejects.toThrow('Booth session disposed')
  })
})

function stillFromColor(rgba: readonly [number, number, number, number]): BoothStill {
  const png = encodeSolidPng(8, 8, rgba)
  return {
    blob: new Blob([png], { type: 'image/png' }),
    width: 8,
    height: 8,
  }
}

async function readPng(blob: Blob): Promise<RgbaImage> {
  return decodePng(new Uint8Array(await blob.arrayBuffer()))
}

function pixelAt(image: RgbaImage, x: number, y: number) {
  const offset = (y * image.width + x) * 4
  return [
    image.data[offset],
    image.data[offset + 1],
    image.data[offset + 2],
    image.data[offset + 3],
  ]
}

function pixelsEqual(left: RgbaImage, right: RgbaImage) {
  if (left.width !== right.width || left.height !== right.height) return false
  if (left.data.length !== right.data.length) return false

  for (let index = 0; index < left.data.length; index++) {
    if (left.data[index] !== right.data[index]) return false
  }

  return true
}
