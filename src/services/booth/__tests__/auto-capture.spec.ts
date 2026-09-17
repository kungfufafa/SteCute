import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  boothSetupsEqual,
  createBoothPeerSession,
  createDefaultBoothSetup,
  createInProcessTransportPair,
  normalizeBoothSetup,
  nextBoothAutoCaptureAction,
  BOOTH_AUTO_CAPTURE_GAP_MS,
} from '@/services/booth'

describe('booth auto-capture setup', () => {
  it('defaults auto-capture off and keeps an explicit on value', () => {
    expect(createDefaultBoothSetup().autoCapture).toBe(false)
    expect(normalizeBoothSetup().autoCapture).toBe(false)
    expect(normalizeBoothSetup({ autoCapture: true }).autoCapture).toBe(true)
  })

  it('treats auto-capture as part of setup equality', () => {
    const off = normalizeBoothSetup({ autoCapture: false })
    const on = normalizeBoothSetup({ autoCapture: true })
    expect(boothSetupsEqual(off, on)).toBe(false)
    expect(boothSetupsEqual(on, normalizeBoothSetup({ autoCapture: true }))).toBe(true)
  })

  it('syncs auto-capture through session-setup', async () => {
    const { host: hostTransport, guest: guestTransport } = createInProcessTransportPair()
    const host = createBoothPeerSession({
      peerId: 'host-auto',
      role: 'host',
      transport: hostTransport,
    })
    const guest = createBoothPeerSession({
      peerId: 'guest-auto',
      role: 'guest',
      transport: guestTransport,
    })

    host.setSetup(normalizeBoothSetup({ autoCapture: true }))
    await expect(guest.waitForSetup()).resolves.toMatchObject({ autoCapture: true })

    host.setSetup(normalizeBoothSetup({ autoCapture: false }))
    await expect(guest.waitForSetup()).resolves.toMatchObject({ autoCapture: false })

    host.dispose()
    guest.dispose()
  })
})

describe('booth auto-capture chain', () => {
  it('uses the same 800ms gap as local camera auto-capture', () => {
    expect(BOOTH_AUTO_CAPTURE_GAP_MS).toBe(800)
  })

  it('starts the next pose when the host chain is armed and capture is ready', () => {
    expect(
      nextBoothAutoCaptureAction({
        enabled: true,
        running: true,
        shotsComplete: false,
        stage: 'live',
        friendJoined: true,
        canStart: true,
      }),
    ).toBe('start')
  })

  it('waits when both peers are present but capture is not ready yet', () => {
    expect(
      nextBoothAutoCaptureAction({
        enabled: true,
        running: true,
        shotsComplete: false,
        stage: 'live',
        friendJoined: true,
        canStart: false,
      }),
    ).toBe('wait')
  })

  it('stops when auto-capture is off, the friend left, or the session left live capture', () => {
    const armed = {
      enabled: true,
      running: true,
      shotsComplete: false,
      stage: 'live' as const,
      friendJoined: true,
      canStart: true,
    }

    expect(nextBoothAutoCaptureAction({ ...armed, enabled: false })).toBe('stop')
    expect(nextBoothAutoCaptureAction({ ...armed, running: false })).toBe('stop')
    expect(nextBoothAutoCaptureAction({ ...armed, friendJoined: false, canStart: false })).toBe(
      'stop',
    )
    expect(nextBoothAutoCaptureAction({ ...armed, shotsComplete: true })).toBe('stop')
    expect(nextBoothAutoCaptureAction({ ...armed, stage: 'review' })).toBe('stop')
  })
})

describe('booth auto-capture UI wiring', () => {
  it('exposes the Otomatis toggle in booth strip setup', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../../../features/booth/BoothStripSetup.vue', import.meta.url)),
      'utf8',
    )
    expect(source).toContain('aria-label="Otomatis"')
    expect(source).toContain('Ambil semua foto otomatis tanpa klik ulang.')
    expect(source).toContain('update({ autoCapture: !setup.autoCapture })')
  })

  it('chains host poses after the local 800ms gap and lets the host cancel', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../../../features/booth/BoothRoomView.vue', import.meta.url)),
      'utf8',
    )
    expect(source).toContain('BOOTH_AUTO_CAPTURE_GAP_MS')
    expect(source).toContain('scheduleNextAutoPose')
    expect(source).toContain('cancelBoothCountdown')
    expect(source).toContain('Batal')
  })
})
