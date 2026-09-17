import { describe, expect, it } from 'vitest'
import {
  boothHostPeerBackgroundLabel,
  boothHostStartLabel,
  isBoothCaptureBackgroundReady,
  shouldConfirmGuestBackgroundReady,
} from '@/services/booth/background-ready'

describe('booth background ready gating', () => {
  it('lets a guest re-confirm after the processor stays ready on a studio background switch', () => {
    expect(
      shouldConfirmGuestBackgroundReady({
        role: 'guest',
        processorStatus: 'ready',
        backgroundId: 'pink',
        hasCustomImage: false,
      }),
    ).toBe(true)
  })

  it('does not treat the host as capture-ready when the guest has not confirmed the new revision', () => {
    expect(
      isBoothCaptureBackgroundReady({
        backgroundId: 'pink',
        localStatus: 'ready',
        friendJoined: true,
        role: 'host',
        peerStatus: { status: 'ready', revision: 1 },
        setupRevision: 2,
        guestStatus: 'ready',
      }),
    ).toBe(false)
  })

  it('treats the host as capture-ready once the guest confirms the current revision', () => {
    expect(
      isBoothCaptureBackgroundReady({
        backgroundId: 'pink',
        localStatus: 'ready',
        friendJoined: true,
        role: 'host',
        peerStatus: { status: 'ready', revision: 2 },
        setupRevision: 2,
        guestStatus: 'ready',
      }),
    ).toBe(true)
  })

  it('does not treat a missing guest status as the host still preparing its own background', () => {
    expect(
      boothHostStartLabel({
        friendJoined: true,
        captureReady: false,
        localReady: true,
      }),
    ).toBe('Teman memuat latar...')
    expect(boothHostPeerBackgroundLabel(null)).toBe('Teman memuat latar...')
  })

  it('shows Mulai pose when both sides are ready', () => {
    expect(
      boothHostStartLabel({
        friendJoined: true,
        captureReady: true,
        localReady: true,
      }),
    ).toBe('Mulai pose')
  })
})
