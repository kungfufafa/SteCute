import { describe, expect, it } from 'vitest'
import {
  createBoothPeerSession,
  createInProcessTransportPair,
  type BoothSessionSetup,
} from '@/services/booth'

describe('booth background asset sync', () => {
  it('syncs custom background asset from host to guest', async () => {
    const { host: hostTransport, guest: guestTransport } = createInProcessTransportPair()
    const host = createBoothPeerSession({
      peerId: 'host-1',
      role: 'host',
      transport: hostTransport,
    })
    const guest = createBoothPeerSession({
      peerId: 'guest-1',
      role: 'guest',
      transport: guestTransport,
    })

    const dummyBlob = new Blob(['mock-custom-background-bytes'], { type: 'image/jpeg' })

    const assetPromise = new Promise<{ revision: number; assetId: string; blob: Blob }>(
      (resolve) => {
        guest.onBackgroundAsset((event) => {
          resolve(event)
        })
      },
    )

    const setup: BoothSessionSetup = {
      layoutId: 'strip-4',
      templateId: 'youth',
      slotCount: 4,
      countdownMs: 3000,
      filterId: 'normal',
      cameraEffectId: 'off',
      virtualBackgroundId: 'custom',
      virtualBackgroundAssetId: 'custom-asset-123',
      revision: 2,
    }

    await host.setSetup(setup, dummyBlob)

    const receivedAsset = await assetPromise
    expect(receivedAsset.assetId).toBe('custom-asset-123')
    expect(receivedAsset.revision).toBe(2)
    const text = await receivedAsset.blob.text()
    expect(text).toBe('mock-custom-background-bytes')

    // Confirm ready from guest
    const statusPromise = new Promise<{ status: string; revision: number }>((resolve) => {
      host.onPeerBackgroundStatus((event) => {
        resolve(event)
      })
    })

    guest.confirmBackgroundReady(2, 'custom-asset-123')
    const status = await statusPromise
    expect(status.status).toBe('ready')
    expect(status.revision).toBe(2)

    host.dispose()
    guest.dispose()
  })

  it('allows guest to request asset if missed', async () => {
    const { host: hostTransport, guest: guestTransport } = createInProcessTransportPair()
    const host = createBoothPeerSession({
      peerId: 'host-2',
      role: 'host',
      transport: hostTransport,
    })
    const guest = createBoothPeerSession({
      peerId: 'guest-2',
      role: 'guest',
      transport: guestTransport,
    })

    const dummyBlob = new Blob(['replayed-asset-bytes'], { type: 'image/jpeg' })
    const setup: BoothSessionSetup = {
      layoutId: 'strip-4',
      templateId: 'youth',
      slotCount: 4,
      countdownMs: 3000,
      filterId: 'normal',
      cameraEffectId: 'off',
      virtualBackgroundId: 'custom',
      virtualBackgroundAssetId: 'asset-replay-1',
      revision: 3,
    }

    await host.setSetup(setup, dummyBlob)

    // Guest requests asset directly
    const assetPromise = new Promise<{ revision: number; assetId: string; blob: Blob }>(
      (resolve) => {
        guest.onBackgroundAsset((event) => {
          resolve(event)
        })
      },
    )

    guest.requestBackgroundAsset(3, 'asset-replay-1')
    const received = await assetPromise
    expect(received.assetId).toBe('asset-replay-1')
    expect(await received.blob.text()).toBe('replayed-asset-bytes')

    host.dispose()
    guest.dispose()
  })

  it('cancels active moment on countdown failure', async () => {
    const { host: hostTransport, guest: guestTransport } = createInProcessTransportPair()
    const host = createBoothPeerSession({
      peerId: 'host-3',
      role: 'host',
      transport: hostTransport,
    })
    const guest = createBoothPeerSession({
      peerId: 'guest-3',
      role: 'guest',
      transport: guestTransport,
    })

    const cancelPromise = new Promise<{ momentIndex?: number; reason?: string }>((resolve) => {
      guest.onMomentCancelled((event) => {
        resolve(event)
      })
    })

    const countdownPromise = guest.waitForCountdown(0)
    host.cancelMoment(0, 'background_error')

    const cancelled = await cancelPromise
    expect(cancelled.momentIndex).toBe(0)
    expect(cancelled.reason).toBe('background_error')

    await expect(countdownPromise).rejects.toThrow('background_error')

    // Also confirm startedMoments for 0 is cleared
    expect(guest.getSetup()).toBeDefined()

    host.dispose()
    guest.dispose()
  })

  it('ignores an asset from an older setup revision', async () => {
    const { host: hostTransport, guest: guestTransport } = createInProcessTransportPair()
    const host = createBoothPeerSession({
      peerId: 'host-stale',
      role: 'host',
      transport: hostTransport,
    })
    const guest = createBoothPeerSession({
      peerId: 'guest-stale',
      role: 'guest',
      transport: guestTransport,
    })

    const customSetup: BoothSessionSetup = {
      layoutId: 'strip-4',
      templateId: 'youth',
      slotCount: 4,
      countdownMs: 3000,
      filterId: 'normal',
      cameraEffectId: 'off',
      virtualBackgroundId: 'custom',
      virtualBackgroundAssetId: 'stale-asset',
      revision: 2,
    }
    await host.setSetup(customSetup, new Blob(['stale'], { type: 'image/jpeg' }))
    await expect(guest.waitForSetup()).resolves.toMatchObject({
      virtualBackgroundId: 'custom',
      revision: 2,
    })

    await host.setSetup({
      ...customSetup,
      virtualBackgroundId: 'off',
      virtualBackgroundAssetId: null,
      revision: 3,
    })
    await expect(guest.waitForSetup()).resolves.toMatchObject({
      virtualBackgroundId: 'off',
      revision: 3,
    })

    let received = false
    guest.onBackgroundAsset(() => {
      received = true
    })
    hostTransport.send({
      type: 'background-asset',
      assetId: 'stale-asset',
      revision: 2,
      hash: '',
      mimeType: 'image/jpeg',
      bytes: new TextEncoder().encode('stale').buffer,
      peerId: 'host-stale',
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(received).toBe(false)

    host.dispose()
    guest.dispose()
  })

  it('lets the guest request a shared fallback to the original background', async () => {
    const { host: hostTransport, guest: guestTransport } = createInProcessTransportPair()
    const host = createBoothPeerSession({
      peerId: 'host-fallback',
      role: 'host',
      transport: hostTransport,
    })
    const guest = createBoothPeerSession({
      peerId: 'guest-fallback',
      role: 'guest',
      transport: guestTransport,
    })

    const customSetup: BoothSessionSetup = {
      layoutId: 'strip-4',
      templateId: 'youth',
      slotCount: 4,
      countdownMs: 3000,
      filterId: 'normal',
      cameraEffectId: 'off',
      virtualBackgroundId: 'custom',
      virtualBackgroundAssetId: 'fallback-asset',
      revision: 2,
    }
    await host.setSetup(customSetup, new Blob(['custom'], { type: 'image/jpeg' }))
    await expect(guest.waitForSetup()).resolves.toMatchObject({ revision: 2 })

    guest.requestBackgroundFallback(2)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(host.getSetup()).toMatchObject({ virtualBackgroundId: 'off', revision: 3 })
    await expect(guest.waitForSetup()).resolves.toMatchObject({
      virtualBackgroundId: 'off',
      virtualBackgroundAssetId: null,
      revision: 3,
    })

    host.dispose()
    guest.dispose()
  })

  it('delivers a new ready revision after the guest already confirmed the previous background', async () => {
    const { host: hostTransport, guest: guestTransport } = createInProcessTransportPair()
    const host = createBoothPeerSession({
      peerId: 'host-reconfirm',
      role: 'host',
      transport: hostTransport,
    })
    const guest = createBoothPeerSession({
      peerId: 'guest-reconfirm',
      role: 'guest',
      transport: guestTransport,
    })

    const firstReady = new Promise<{ status: string; revision: number }>((resolve) => {
      host.onPeerBackgroundStatus((event) => {
        if (event.revision === 1) resolve(event)
      })
    })
    guest.confirmBackgroundReady(1)
    await expect(firstReady).resolves.toMatchObject({ status: 'ready', revision: 1 })

    const secondReady = new Promise<{ status: string; revision: number }>((resolve) => {
      host.onPeerBackgroundStatus((event) => {
        if (event.revision === 2) resolve(event)
      })
    })
    guest.confirmBackgroundReady(2)
    await expect(secondReady).resolves.toMatchObject({ status: 'ready', revision: 2 })
    expect(host.getPeerBackgroundStatus()).toMatchObject({ status: 'ready', revision: 2 })

    host.dispose()
    guest.dispose()
  })
})
