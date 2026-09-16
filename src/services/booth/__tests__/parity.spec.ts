import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Shot } from '@/db/schema'
import { createDefaultDecorationConfig, isSessionComplete } from '@/services/session'
import { renderStrip } from '@/services/render'
import { getPhotoFilterById } from '@/services/filter'
import { strip4Config } from '@/layouts/strip-4/config'
import { youthTemplate } from '@/templates/youth/config'
import {
  composePairRow,
  createBoothPeerSession,
  createInProcessTransportPair,
  normalizeBoothSetup,
  type BoothStill,
} from '@/services/booth'
import { decodePng, encodeSolidPng, type RgbaImage } from '../png'
import { installSoftwareCanvas } from './software-canvas'

const PAIR_SLOT = { width: 32, height: 24 }

beforeAll(() => {
  installSoftwareCanvas()
})

describe('booth bundled strip parity', () => {
  it('ships the shared review and output actions in the booth room', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../../../features/booth/BoothRoomView.vue', import.meta.url)),
      'utf8',
    )
    const decoration = readFileSync(
      fileURLToPath(new URL('../../../features/booth/BoothDecorationPicker.vue', import.meta.url)),
      'utf8',
    )
    expect(source).toContain('Ulang Semua')
    expect(source).toContain('waitForReset')
    expect(source).toContain('Buat Hasil Akhir')
    expect(source).toContain('Unduh PNG')
    expect(source).toContain('booth-local-tile')
    expect(source).toContain('booth-remote-tile')
    expect(source).toContain('faceBounds: latestOverlayFaces.value.map')
    expect(source).toContain('cameraEffectFrameMs: shot.cameraEffectFrameMs')
    expect(decoration).toContain('Pilih efek ${filter.label}')
    expect(decoration).toContain('Pilih overlay ${effect.label}')
  })

  it('captures layout slotCount pair-rows and renders Youth 4-foto with a real filter', async () => {
    const setup = normalizeBoothSetup({
      layoutId: strip4Config.id,
      templateId: youthTemplate.id,
      countdownMs: 3000,
      filterId: 'normal',
      cameraEffectId: 'hearts',
    })
    expect(setup.slotCount).toBe(strip4Config.slotCount)
    expect(setup.templateId).toBe('youth')
    expect(setup.cameraEffectId).toBe('hearts')

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

    host.setSetup(setup)
    await expect(guest.waitForSetup()).resolves.toMatchObject({
      layoutId: strip4Config.id,
      templateId: youthTemplate.id,
      slotCount: 4,
      filterId: 'normal',
      cameraEffectId: 'hearts',
    })

    for (let momentIndex = 0; momentIndex < setup.slotCount; momentIndex++) {
      const guestStart = guest.waitForStart()
      host.startMoment(momentIndex, setup.countdownMs)
      await expect(guestStart).resolves.toEqual({
        momentIndex,
        countdownMs: setup.countdownMs,
      })
      await Promise.all([
        host.submitStill(momentIndex, hostStill),
        guest.submitStill(momentIndex, guestStill),
      ])
      await host.waitForComposed(momentIndex)
    }

    const composed = host.getComposedByOrder()
    expect(composed).toHaveLength(strip4Config.slotCount)
    expect(isSessionComplete(composed, strip4Config.slotCount)).toBe(true)
    expect(composed.every((entry) => entry.shot.width === PAIR_SLOT.width)).toBe(true)

    const directCompose = await composePairRow(hostStill, guestStill, PAIR_SLOT)
    expect(directCompose.width).toBe(PAIR_SLOT.width)

    const shots = toShots(composed, setup.cameraEffectId)
    expect(shots.every((shot) => shot.cameraEffectId === 'hearts')).toBe(true)
    expect(shots.map((shot) => shot.order)).toEqual([0, 1, 2, 3])

    const defaultDecoration = createDefaultDecorationConfig(youthTemplate, {
      cameraEffectId: setup.cameraEffectId,
    })
    expect(defaultDecoration.cameraEffectId).toBe('hearts')
    expect(defaultDecoration.filterId).toBe('normal')

    const warmFilter = getPhotoFilterById('warm')
    expect(warmFilter.id).toBe('warm')
    expect(warmFilter.canvasFilter).not.toBe('none')

    const filteredDecoration = createDefaultDecorationConfig(youthTemplate, {
      filterId: warmFilter.id,
      cameraEffectId: setup.cameraEffectId,
    })
    expect(filteredDecoration.filterId).toBe('warm')
    expect(filteredDecoration.cameraEffectId).toBe('hearts')

    const plain = await renderStrip({
      layout: strip4Config,
      template: youthTemplate,
      shots,
      decoration: defaultDecoration,
      format: 'image/png',
    })
    const filtered = await renderStrip({
      layout: strip4Config,
      template: youthTemplate,
      shots,
      decoration: filteredDecoration,
      format: 'image/png',
    })

    expect(plain.width).toBe(strip4Config.canvas.width)
    expect(plain.height).toBe(strip4Config.canvas.height)
    expect(filtered.width).toBe(strip4Config.canvas.width)
    expect(filtered.height).toBe(strip4Config.canvas.height)
    expect(plain.blob.type).toBe('image/png')
    expect(filtered.blob.type).toBe('image/png')

    const plainPixels = await readPng(plain.blob)
    const filteredPixels = await readPng(filtered.blob)
    expect(plainPixels.width).toBe(strip4Config.canvas.width)
    expect(pixelsEqual(plainPixels, filteredPixels)).toBe(false)

    host.dispose()
    guest.dispose()
  })

  it('replaces one composed moment on per-shot retake and re-renders a different strip', async () => {
    const setup = normalizeBoothSetup({
      layoutId: strip4Config.id,
      templateId: youthTemplate.id,
      countdownMs: 3000,
    })
    const hostStill = stillFromColor([220, 24, 32, 255])
    const guestStill = stillFromColor([32, 64, 220, 255])
    const retakeHostStill = stillFromColor([24, 180, 64, 255])
    const retakeGuestStill = stillFromColor([240, 200, 32, 255])
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

    host.setSetup(setup)

    for (let momentIndex = 0; momentIndex < setup.slotCount; momentIndex++) {
      const guestStart = guest.waitForStart()
      host.startMoment(momentIndex, setup.countdownMs)
      await guestStart
      await Promise.all([
        host.submitStill(momentIndex, hostStill),
        guest.submitStill(momentIndex, guestStill),
      ])
      await host.waitForComposed(momentIndex)
    }

    const before = host.getComposedByOrder()
    expect(isSessionComplete(before, strip4Config.slotCount)).toBe(true)

    const decoration = createDefaultDecorationConfig(youthTemplate)
    const beforeStrip = await renderStrip({
      layout: strip4Config,
      template: youthTemplate,
      shots: toShots(before),
      decoration,
      format: 'image/png',
    })

    const guestRetake = guest.waitForStart()
    host.startMoment(1, setup.countdownMs)
    await expect(guestRetake).resolves.toEqual({ momentIndex: 1, countdownMs: setup.countdownMs })
    expect(isSessionComplete(host.getComposedByOrder(), strip4Config.slotCount)).toBe(false)
    expect(host.getComposedByOrder()).toHaveLength(strip4Config.slotCount - 1)

    await host.submitStill(1, retakeHostStill)
    expect(isSessionComplete(host.getComposedByOrder(), strip4Config.slotCount)).toBe(false)
    await guest.submitStill(1, retakeGuestStill)
    await host.waitForComposed(1)

    const after = host.getComposedByOrder()
    expect(after).toHaveLength(strip4Config.slotCount)
    expect(isSessionComplete(after, strip4Config.slotCount)).toBe(true)
    expect(after.map((entry) => entry.order)).toEqual([0, 1, 2, 3])

    const afterStrip = await renderStrip({
      layout: strip4Config,
      template: youthTemplate,
      shots: toShots(after),
      decoration,
      format: 'image/png',
    })

    expect(afterStrip.width).toBe(strip4Config.canvas.width)
    expect(afterStrip.height).toBe(strip4Config.canvas.height)
    expect(pixelsEqual(await readPng(beforeStrip.blob), await readPng(afterStrip.blob))).toBe(false)

    host.dispose()
    guest.dispose()
  })

  it('empties guest composed shots when the host resets the shared capture', async () => {
    const setup = normalizeBoothSetup({
      layoutId: strip4Config.id,
      templateId: youthTemplate.id,
      countdownMs: 3000,
    })
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

    host.setSetup(setup)
    for (let momentIndex = 0; momentIndex < setup.slotCount; momentIndex++) {
      const guestStart = guest.waitForStart()
      host.startMoment(momentIndex, setup.countdownMs)
      await guestStart
      await Promise.all([
        host.submitStill(momentIndex, hostStill),
        guest.submitStill(momentIndex, guestStill),
      ])
      await guest.waitForComposed(momentIndex)
    }

    expect(isSessionComplete(guest.getComposedByOrder(), strip4Config.slotCount)).toBe(true)
    const guestReset = guest.waitForReset()
    host.resetCapture()
    await guestReset

    expect(guest.getComposedByOrder()).toEqual([])
    expect(host.getComposedByOrder()).toEqual([])
    expect(isSessionComplete(guest.getComposedByOrder(), strip4Config.slotCount)).toBe(false)

    host.dispose()
    guest.dispose()
  })

  it('maps captured host and guest faces into pair-row coordinates for PNG overlay', async () => {
    const hostStill = stillFromColor([220, 24, 32, 255], {
      faceBounds: [{ x: 0.5, y: 0.2, width: 0.2, height: 0.3 }],
      cameraEffectFrameMs: 180,
    })
    const guestStill = stillFromColor([32, 64, 220, 255], {
      faceBounds: [{ x: 0.45, y: 0.22, width: 0.2, height: 0.28 }],
      cameraEffectFrameMs: 40,
    })
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

    await Promise.all([host.submitStill(0, hostStill), guest.submitStill(0, guestStill)])
    const composed = await host.waitForComposed(0)
    const direct = await composePairRow(hostStill, guestStill, PAIR_SLOT)

    expect(composed.faceBounds).toHaveLength(2)
    expect(direct.faceBounds).toHaveLength(2)
    expect(composed.cameraEffectFrameMs).toBe(180)
    const hostFace = composed.faceBounds[0]
    const guestFace = composed.faceBounds[1]
    expect(hostFace.x + hostFace.width / 2).toBeLessThan(0.5)
    expect(guestFace.x + guestFace.width / 2).toBeGreaterThan(0.5)
    expect(guestFace.x).toBeGreaterThan(hostFace.x)

    const shots = toShots([{ order: 0, shot: composed }], 'hearts')
    expect(shots[0].faceBounds).toEqual(composed.faceBounds)
    expect(shots[0].cameraEffectFrameMs).toBe(180)

    const rendered = await renderStrip({
      layout: strip4Config,
      template: youthTemplate,
      shots,
      decoration: createDefaultDecorationConfig(youthTemplate, { cameraEffectId: 'hearts' }),
      format: 'image/png',
    })
    expect(rendered.width).toBe(strip4Config.canvas.width)
    expect(rendered.blob.type).toBe('image/png')

    host.dispose()
    guest.dispose()
  })
})

function toShots(
  composed: Array<{
    order: number
    shot: {
      blob: Blob
      width: number
      height: number
      faceBounds?: Shot['faceBounds']
      cameraEffectFrameMs?: number
    }
  }>,
  cameraEffectId?: string,
): Shot[] {
  return composed.map(({ order, shot }) => ({
    id: `booth-parity-${order}`,
    sessionId: 'booth-parity',
    order,
    sourceType: 'camera',
    blob: shot.blob,
    width: shot.width,
    height: shot.height,
    cameraEffectId,
    cameraEffectFrameMs: shot.cameraEffectFrameMs ?? 0,
    faceBounds: shot.faceBounds?.map((face) => ({ ...face })),
    createdAt: Date.now(),
  }))
}

function stillFromColor(
  rgba: readonly [number, number, number, number],
  extra: Partial<Pick<BoothStill, 'faceBounds' | 'cameraEffectFrameMs'>> = {},
): BoothStill {
  const png = encodeSolidPng(8, 8, rgba)
  return {
    blob: new Blob([png], { type: 'image/png' }),
    width: 8,
    height: 8,
    ...extra,
  }
}

async function readPng(blob: Blob): Promise<RgbaImage> {
  return decodePng(new Uint8Array(await blob.arrayBuffer()))
}

function pixelsEqual(left: RgbaImage, right: RgbaImage) {
  if (left.width !== right.width || left.height !== right.height) return false
  if (left.data.length !== right.data.length) return false
  for (let index = 0; index < left.data.length; index++) {
    if (left.data[index] !== right.data[index]) return false
  }
  return true
}
