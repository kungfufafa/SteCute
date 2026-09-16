export type BoothIceServer = {
  urls: string | string[]
  username?: string
  credential?: string
}

const STUN_SERVERS: BoothIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.relay.metered.ca:80' },
  { urls: 'stun:stun.relay.metered.ca:443' },
]

export function getBoothStunServers(): BoothIceServer[] {
  return STUN_SERVERS.map((server) => ({ ...server }))
}

export async function getBoothIceServers(signal?: AbortSignal): Promise<BoothIceServer[]> {
  const configured = [...readEnvIceServers(), ...(await fetchConfiguredTurnServers(signal))]
  return [...getBoothStunServers(), ...configured]
}

export function boothPeerRtcConfig(iceServers: BoothIceServer[]) {
  return {
    iceServers,
    iceCandidatePoolSize: 8,
    iceTransportPolicy: 'all' as const,
  }
}

function readEnvIceServers(): BoothIceServer[] {
  const raw = readViteEnv('VITE_BOOTH_ICE_SERVERS')
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw) as unknown
    return normalizeIceServers(parsed)
  } catch {
    return []
  }
}

async function fetchConfiguredTurnServers(signal?: AbortSignal): Promise<BoothIceServer[]> {
  const url = readViteEnv('VITE_BOOTH_TURN_CREDENTIALS_URL') || defaultMeteredCredentialsUrl()
  if (!url) return []

  try {
    const response = await fetch(url, { signal })
    if (!response.ok) return []
    return normalizeIceServers(await response.json())
  } catch {
    return []
  }
}

function defaultMeteredCredentialsUrl(): string | null {
  const apiKey = readViteEnv('VITE_BOOTH_TURN_API_KEY')
  if (!apiKey) return null
  const appName = readViteEnv('VITE_BOOTH_TURN_APP') || 'openrelay'
  return `https://${appName}.metered.live/api/v1/turn/credentials?apiKey=${encodeURIComponent(apiKey)}`
}

function normalizeIceServers(value: unknown): BoothIceServer[] {
  const list = Array.isArray(value)
    ? value
    : value &&
        typeof value === 'object' &&
        Array.isArray((value as { iceServers?: unknown }).iceServers)
      ? (value as { iceServers: unknown[] }).iceServers
      : []

  return list.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const record = entry as {
      urls?: unknown
      url?: unknown
      username?: unknown
      credential?: unknown
    }
    const urls = record.urls ?? record.url
    if (typeof urls !== 'string' && !Array.isArray(urls)) return []
    const server: BoothIceServer = {
      urls: Array.isArray(urls) ? urls.map(String) : String(urls),
    }
    if (typeof record.username === 'string') server.username = record.username
    if (typeof record.credential === 'string') server.credential = record.credential
    return [server]
  })
}

function readViteEnv(name: string): string {
  try {
    const value = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.[
      name
    ]
    return typeof value === 'string' ? value.trim() : ''
  } catch {
    return ''
  }
}
