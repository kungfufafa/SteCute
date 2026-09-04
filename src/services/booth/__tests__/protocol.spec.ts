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
