import { describe, expect, it } from 'vitest'
import { createBoothPeerSession, createInProcessTransportPair } from '@/services/booth'
import { shouldMirrorCamera } from '@/services/camera'

describe('booth camera facing sync', () => {
  it('defaults remote facing to unknown (not mirrored) until the peer reports', () => {
    const { host: hostTransport, guest: guestTransport } = createInProcessTransportPair()
    const host = createBoothPeerSession({
      peerId: 'host-facing',
      role: 'host',
      transport: hostTransport,
    })
    const guest = createBoothPeerSession({
      peerId: 'guest-facing',
      role: 'guest',
      transport: guestTransport,
    })

    expect(host.getRemoteCameraFacingMode()).toBe('unknown')
    expect(guest.getRemoteCameraFacingMode()).toBe('unknown')
    expect(shouldMirrorCamera(guest.getRemoteCameraFacingMode())).toBe(false)

    host.dispose()
    guest.dispose()
  })

  it('mirrors the remote tile from the remote facing mode, not the local one', async () => {
    const { host: hostTransport, guest: guestTransport } = createInProcessTransportPair()
    const host = createBoothPeerSession({
      peerId: 'host-selfie',
      role: 'host',
      transport: hostTransport,
    })
    const guest = createBoothPeerSession({
      peerId: 'guest-rear',
      role: 'guest',
      transport: guestTransport,
    })

    host.setCameraFacingMode('user')
    guest.setCameraFacingMode('environment')
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Host uses selfie, guest uses rear: each side mirrors only the selfie footage.
    expect(host.getRemoteCameraFacingMode()).toBe('environment')
    expect(guest.getRemoteCameraFacingMode()).toBe('user')
    expect(shouldMirrorCamera(host.getRemoteCameraFacingMode())).toBe(false)
    expect(shouldMirrorCamera(guest.getRemoteCameraFacingMode())).toBe(true)

    host.dispose()
    guest.dispose()
  })

  it('propagates facing-mode changes and replays the current mode to a joining peer', async () => {
    const { host: hostTransport, guest: guestTransport } = createInProcessTransportPair()
    const host = createBoothPeerSession({
      peerId: 'host-flip',
      role: 'host',
      transport: hostTransport,
    })
    host.setCameraFacingMode('environment')

    // Guest joins later; the hello/welcome handshake must carry the host mode.
    const guest = createBoothPeerSession({
      peerId: 'guest-flip',
      role: 'guest',
      transport: guestTransport,
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(guest.getRemoteCameraFacingMode()).toBe('environment')

    host.setCameraFacingMode('user')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(guest.getRemoteCameraFacingMode()).toBe('user')

    host.dispose()
    guest.dispose()
  })

  it('resets remote facing to unknown when the peer leaves', async () => {
    const { host: hostTransport, guest: guestTransport } = createInProcessTransportPair()
    const host = createBoothPeerSession({
      peerId: 'host-bye',
      role: 'host',
      transport: hostTransport,
    })
    const guest = createBoothPeerSession({
      peerId: 'guest-bye',
      role: 'guest',
      transport: guestTransport,
    })

    guest.setCameraFacingMode('user')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(host.getRemoteCameraFacingMode()).toBe('user')

    guest.dispose()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(host.getRemoteCameraFacingMode()).toBe('unknown')
    expect(shouldMirrorCamera(host.getRemoteCameraFacingMode())).toBe(false)

    host.dispose()
  })

  it('ignores facing messages from peers other than the current remote', async () => {
    const { host: hostTransport, guest: guestTransport } = createInProcessTransportPair()
    const host = createBoothPeerSession({
      peerId: 'host-guard',
      role: 'host',
      transport: hostTransport,
    })
    const guest = createBoothPeerSession({
      peerId: 'guest-guard',
      role: 'guest',
      transport: guestTransport,
    })

    guest.setCameraFacingMode('environment')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(host.getRemoteCameraFacingMode()).toBe('environment')

    guestTransport.send({ type: 'camera-facing', peerId: 'intruder', facingMode: 'user' })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(host.getRemoteCameraFacingMode()).toBe('environment')

    host.dispose()
    guest.dispose()
  })
})
