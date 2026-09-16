import { describe, expect, it } from 'vitest'
import { boothPeerRtcConfig, getBoothIceServers, getBoothStunServers } from '../ice'

describe('booth ICE servers', () => {
  it('includes STUN on ports that office networks usually allow', async () => {
    const urls = getBoothStunServers().flatMap((server) =>
      Array.isArray(server.urls) ? server.urls : [server.urls],
    )

    expect(urls).toEqual(
      expect.arrayContaining([
        'stun:stun.l.google.com:19302',
        'stun:stun.cloudflare.com:3478',
        'stun:stun.relay.metered.ca:80',
        'stun:stun.relay.metered.ca:443',
      ]),
    )

    const iceServers = await getBoothIceServers()
    const config = boothPeerRtcConfig(iceServers)
    expect(config.iceTransportPolicy).toBe('all')
    expect(config.iceCandidatePoolSize).toBe(8)
    expect(config.iceServers.length).toBeGreaterThanOrEqual(urls.length)
  })
})
