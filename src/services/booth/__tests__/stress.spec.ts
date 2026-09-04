import { beforeAll, describe, expect, it } from 'vitest'
import type { LayoutConfig, Shot } from '@/db/schema'
import { createDefaultDecorationConfig } from '@/services/session'
import { renderStrip } from '@/services/render'
import { classicTemplate } from '@/templates/classic/config'
import { validateFiles } from '@/services/upload'
import {
  BOOTH_TTL_MS,
  composePairRow,
  createBooth,
  createBoothPeerSession,
  createInProcessTransportPair,
  createLocalStorageRegistry,
  createMemoryRegistry,
  joinBoothByCode,
  joinBoothByInvite,
  normalizeBoothCode,
  type BoothStill,
} from '@/services/booth'
import { decodePng, encodeSolidPng } from '../png'
import { installSoftwareCanvas } from './software-canvas'

const PAIR_SLOT = { width: 16, height: 8 }
const BOOTH_COUNT = 400
const PAIR_COUNT = 40
const MOMENTS_PER_PAIR = 6

const stripLayout: LayoutConfig = {
  id: 'strip-6-vertical',
  name: '6 Foto',
  slotCount: 6,
  printFormat: {
    id: 'fit-6-photo-strip',
    label: '6 Foto',
    paperSize: 'Fit 6 foto',
    description: 'Kertas panjang',
    fileSlug: 'fit-6-photo-strip',
  },
  canvas: { width: 48, height: 160 },
  slots: Array.from({ length: 6 }, (_, index) => ({
    x: 4,
    y: 4 + index * 26,
    width: 40,
    height: 22,
    radius: 0,
  })),
}

beforeAll(() => {
  installSoftwareCanvas()
})

describe('booth identity stress', () => {
  it('allocates hundreds of unique booths that all join by code and invite', () => {
    const registry = createMemoryRegistry()
    const booths = Array.from({ length: BOOTH_COUNT }, () => createBooth(registry))
    const codes = new Set(booths.map((booth) => normalizeBoothCode(booth.code)))
    const ids = new Set(booths.map((booth) => booth.boothId))

    expect(codes.size).toBe(BOOTH_COUNT)
    expect(ids.size).toBe(BOOTH_COUNT)

    for (const booth of booths) {
      const compact = booth.code.replace('-', '').toLowerCase()
      const byCode = joinBoothByCode(`  ${compact}  `, registry)
      const byInvite = joinBoothByInvite(
        `https://stecute.example/j/${compact}?n=${booth.boothId}`,
        registry,
      )

      expect(byCode.ok && byCode.identity.boothId).toBe(booth.boothId)
      expect(byInvite.ok && byInvite.identity.boothId).toBe(booth.boothId)
    }
  })

  it('rejects a flood of missing, malformed, and unknown join inputs', () => {
    const registry = createMemoryRegistry()
    createBooth(registry)

    const missing = ['', '   ', '\n\t', null, undefined]
    const malformed = [
      '@@@',
      'AB',
      'ABCDEFG',
      'ABC0EF',
      'ABCIEF',
      '******',
      '🎉🎉🎉🎉🎉🎉',
      'A'.repeat(10_000),
      '/j/',
      '/j/!!',
      '/gallery',
      'http://localhost/booth',
      '<script>alert(1)</script>',
    ]
    const unknown = ['ZZZZZZ', '222222', 'HJKMNP', 'ZZZ-ZZZ', '/j/AAA-AAA']

    for (const input of missing) {
      expect(joinBoothByCode(input, registry).ok).toBe(false)
      expect(joinBoothByInvite(input, registry).ok).toBe(false)
    }

    for (const input of malformed) {
      const result = joinBoothByCode(input, registry)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(['missing', 'malformed']).toContain(result.reason)
    }

    for (const input of unknown) {
      const result = /\/j\//.test(input)
        ? joinBoothByInvite(input, registry)
        : joinBoothByCode(input, registry)
      expect(result).toEqual({ ok: false, reason: 'unknown' })
    }
  })

  it('persists many rooms in localStorage-shaped storage and drops expired ones', () => {
    const memory = new Map<string, string>()
    const storage: Storage = {
      get length() {
        return memory.size
      },
      clear() {
        memory.clear()
      },
      getItem(key) {
        return memory.get(key) ?? null
      },
      key(index) {
        return [...memory.keys()][index] ?? null
      },
      removeItem(key) {
        memory.delete(key)
      },
      setItem(key, value) {
        memory.set(key, String(value))
      },
    }

    const registry = createLocalStorageRegistry(storage)
    const booths = Array.from({ length: 80 }, () => createBooth(registry))

    expect(joinBoothByCode(booths[0].code, registry).ok).toBe(true)

    const expiredKey = normalizeBoothCode(booths[0].code)
    const raw = JSON.parse(memory.get('stecute.booth.rooms.v1') ?? '{}') as Record<
      string,
      { createdAt: number }
    >
    if (!expiredKey || !raw[expiredKey]) {
      throw new Error('Expected the first booth to be stored.')
    }
    raw[expiredKey].createdAt = Date.now() - BOOTH_TTL_MS - 1000
    memory.set('stecute.booth.rooms.v1', JSON.stringify(raw))

    expect(joinBoothByCode(booths[0].code, registry)).toEqual({ ok: false, reason: 'unknown' })
    expect(joinBoothByCode(booths[1].code, registry).ok).toBe(true)
  })

  it('fails closed when every generated code is already taken', () => {
    const saturated = createMemoryRegistry()
    saturated.findByNormalizedCode = () => ({
      boothId: 'taken',
      code: 'AAA-AAA',
      invitePath: '/j/AAA-AAA',
    })

    expect(() => createBooth(saturated)).toThrow(/unique booth code/)
  })
})

describe('booth protocol and compose stress', () => {
  it('runs many two-peer booths through six moments without mixing rooms', async () => {
    const pairs = Array.from({ length: PAIR_COUNT }, (_, index) => {
      const { host: hostTransport, guest: guestTransport } = createInProcessTransportPair()
      return {
        host: createBoothPeerSession({
          peerId: `host-${index}`,
          role: 'host',
          transport: hostTransport,
          slot: PAIR_SLOT,
        }),
        guest: createBoothPeerSession({
          peerId: `guest-${index}`,
          role: 'guest',
          transport: guestTransport,
          slot: PAIR_SLOT,
        }),
        hostStill: stillFromColor([10 + (index % 200), 20, 30, 255]),
        guestStill: stillFromColor([30, 20, 220 - (index % 200), 255]),
      }
    })

    await Promise.all(
      pairs.map(async ({ host, guest, hostStill, guestStill }, pairIndex) => {
        for (let moment = 0; moment < MOMENTS_PER_PAIR; moment++) {
          const waiting = guest.waitForCountdown(moment)
          host.startMoment(moment, 100 + pairIndex)
          await expect(waiting).resolves.toBe(100 + pairIndex)
          await Promise.all([
            host.submitStill(moment, hostStill),
            guest.submitStill(moment, guestStill),
          ])
          const composed = await host.waitForComposed(moment)
          expect(composed.width).toBe(PAIR_SLOT.width)
          expect(composed.height).toBe(PAIR_SLOT.height)
          expect(composed.blob.size).toBeGreaterThan(0)
        }

        expect(host.getComposedShots()).toHaveLength(MOMENTS_PER_PAIR)
        expect(guest.getRemotePeerId()).toBe(`host-${pairIndex}`)
        expect(host.getRemotePeerId()).toBe(`guest-${pairIndex}`)
        host.dispose()
        guest.dispose()
      }),
    )
  }, 30_000)

  it('composes out-of-order moments and ignores duplicate stills for a finished moment', async () => {
    const { host: hostTransport, guest: guestTransport } = createInProcessTransportPair()
    const host = createBoothPeerSession({
      peerId: 'host-order',
      role: 'host',
      transport: hostTransport,
      slot: PAIR_SLOT,
    })
    const guest = createBoothPeerSession({
      peerId: 'guest-order',
      role: 'guest',
      transport: guestTransport,
      slot: PAIR_SLOT,
    })
    const red = stillFromColor([220, 24, 32, 255])
    const blue = stillFromColor([32, 64, 220, 255])
    const green = stillFromColor([16, 200, 64, 255])

    await Promise.all([host.submitStill(2, red), guest.submitStill(2, blue)])
    await Promise.all([host.submitStill(0, red), guest.submitStill(0, blue)])
    await Promise.all([host.submitStill(1, red), guest.submitStill(1, blue)])
    const first = await host.waitForComposed(0)
    await Promise.all([host.submitStill(0, green), guest.submitStill(0, green)])

    expect(await host.waitForComposed(0)).toBe(first)
    expect(host.getComposedShots()).toHaveLength(3)
    host.dispose()
    guest.dispose()
  })

  it('rejects guest countdown starts and does not hang on garbage stills', async () => {
    const { host: hostTransport, guest: guestTransport } = createInProcessTransportPair()
    const host = createBoothPeerSession({
      peerId: 'host-bad',
      role: 'host',
      transport: hostTransport,
      slot: PAIR_SLOT,
    })
    const guest = createBoothPeerSession({
      peerId: 'guest-bad',
      role: 'guest',
      transport: guestTransport,
      slot: PAIR_SLOT,
    })

    expect(() => guest.startMoment(0)).toThrow(/Only the booth host/)

    const garbage: BoothStill = {
      blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'application/octet-stream' }),
      width: 8,
      height: 8,
    }
    const pending = host.waitForComposed(0)
    await Promise.allSettled([host.submitStill(0, garbage), guest.submitStill(0, garbage)])
    await expect(pending).rejects.toThrow(/Unable to decode booth still|Not a PNG image/)

    const red = stillFromColor([220, 24, 32, 255])
    const blue = stillFromColor([32, 64, 220, 255])
    await Promise.all([host.submitStill(1, red), guest.submitStill(1, blue)])
    await expect(host.waitForComposed(1)).resolves.toMatchObject({ width: 16, height: 8 })

    host.dispose()
    guest.dispose()
  })

  it('rejects waiters when a session is disposed mid-flight', async () => {
    const { host: hostTransport, guest: guestTransport } = createInProcessTransportPair()
    const host = createBoothPeerSession({
      peerId: 'host-dispose',
      role: 'host',
      transport: hostTransport,
      slot: PAIR_SLOT,
    })
    createBoothPeerSession({
      peerId: 'guest-dispose',
      role: 'guest',
      transport: guestTransport,
      slot: PAIR_SLOT,
    })

    const pending = host.waitForComposed(0)
    host.dispose()
    await expect(pending).rejects.toThrow(/disposed/)
    expect(() => host.startMoment(0)).toThrow(/disposed/)
  })

  it('round-trips PNG pixels and keeps pair-row swap inequality at production slot size', async () => {
    const red = stillFromColor([200, 10, 10, 255], 64, 48)
    const blue = stillFromColor([10, 10, 200, 255], 48, 64)
    const slot = { width: 120, height: 80 }
    const composed = await composePairRow(red, blue, slot)
    const swapped = await composePairRow(blue, red, slot)
    const composedPixels = decodePng(new Uint8Array(await composed.blob.arrayBuffer()))
    const swappedPixels = decodePng(new Uint8Array(await swapped.blob.arrayBuffer()))

    expect(composed.width).toBe(120)
    expect(composed.height).toBe(80)
    expect(pixelAt(composedPixels, 2, 40)).not.toEqual(pixelAt(composedPixels, 118, 40))
    expect(pixelAt(composedPixels, 2, 40)).toEqual(pixelAt(swappedPixels, 118, 40))
  })

  it('feeds six composed booth shots through the shipped strip renderer', async () => {
    const { host: hostTransport, guest: guestTransport } = createInProcessTransportPair()
    const host = createBoothPeerSession({
      peerId: 'host-render',
      role: 'host',
      transport: hostTransport,
      slot: PAIR_SLOT,
    })
    const guest = createBoothPeerSession({
      peerId: 'guest-render',
      role: 'guest',
      transport: guestTransport,
      slot: PAIR_SLOT,
    })
    const red = stillFromColor([220, 24, 32, 255])
    const blue = stillFromColor([32, 64, 220, 255])

    for (let moment = 0; moment < 6; moment++) {
      await Promise.all([host.submitStill(moment, red), guest.submitStill(moment, blue)])
    }

    const shots: Shot[] = host.getComposedShots().map((shot, order) => ({
      id: `stress-shot-${order}`,
      sessionId: 'booth-stress',
      order,
      sourceType: 'camera',
      blob: shot.blob,
      width: shot.width,
      height: shot.height,
      createdAt: Date.now(),
    }))

    const rendered = await renderStrip({
      layout: stripLayout,
      template: classicTemplate,
      shots,
      decoration: createDefaultDecorationConfig(),
      format: 'image/png',
    })

    expect(shots).toHaveLength(6)
    expect(rendered.blob.type).toBe('image/png')
    expect(rendered.blob.size).toBeGreaterThan(0)
    host.dispose()
    guest.dispose()
  })
})

describe('upload validation stress', () => {
  it('rejects oversized batches without accepting a mixed invalid set', () => {
    const files = Array.from({ length: 80 }, (_, index) => {
      if (index % 7 === 0) return file(`bad-${index}.txt`, 'text/plain', 1024)
      if (index % 11 === 0) return file(`huge-${index}.png`, 'image/png', 11 * 1024 * 1024)
      return file(`ok-${index}.jpg`, 'image/jpeg', 2048)
    })

    const result = validateFiles(files, 4)

    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(3)
    expect(result.errors.some((error) => error.includes('4 foto'))).toBe(true)
  })
})

function stillFromColor(
  rgba: readonly [number, number, number, number],
  width = 8,
  height = 8,
): BoothStill {
  const png = encodeSolidPng(width, height, rgba)
  return {
    blob: new Blob([png], { type: 'image/png' }),
    width,
    height,
  }
}

function pixelAt(image: { width: number; data: Uint8ClampedArray }, x: number, y: number) {
  const offset = (y * image.width + x) * 4
  return [
    image.data[offset],
    image.data[offset + 1],
    image.data[offset + 2],
    image.data[offset + 3],
  ]
}

function file(name: string, type: string, size: number): File {
  return { name, type, size } as File
}
