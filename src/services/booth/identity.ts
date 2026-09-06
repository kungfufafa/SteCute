export const BOOTH_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const BOOTH_CODE_LENGTH = 6
export const BOOTH_INVITE_PREFIX = '/j/'
export const BOOTH_STORAGE_KEY = 'stecute.booth.rooms.v1'
export const BOOTH_TTL_MS = 30 * 60 * 1000

export type BoothIdentity = {
  boothId: string
  code: string
  invitePath: string
}

export type BoothJoinError = 'missing' | 'malformed' | 'unknown'

export type BoothJoinResult =
  | { ok: true; identity: BoothIdentity }
  | { ok: false; reason: BoothJoinError }

export interface BoothRegistry {
  save(identity: BoothIdentity): void
  findByNormalizedCode(normalized: string): BoothIdentity | undefined
}

type StoredBooth = BoothIdentity & { createdAt: number }

let registryOverride: BoothRegistry | null = null
let memoryFallback: BoothRegistry | null = null

export function normalizeBoothCode(input: string | null | undefined): string | null {
  if (input == null) return null

  const normalized = input.trim().replace(/[-\s]/g, '').toUpperCase()
  if (!normalized) return null
  if (normalized.length !== BOOTH_CODE_LENGTH) return null
  if ([...normalized].some((char) => !BOOTH_CODE_ALPHABET.includes(char))) return null

  return normalized
}

export function formatBoothCode(normalized: string): string {
  const code = normalizeBoothCode(normalized)
  if (!code) {
    throw new Error('Cannot format an invalid booth code.')
  }

  return `${code.slice(0, 3)}-${code.slice(3)}`
}

export function buildInvitePath(code: string): string {
  return `${BOOTH_INVITE_PREFIX}${formatBoothCode(normalizeBoothCode(code) ?? code)}`
}

export function parseInviteCode(urlOrPath: string | null | undefined): string | null {
  if (urlOrPath == null) return null

  const trimmed = urlOrPath.trim()
  if (!trimmed) return null

  try {
    const url = trimmed.includes('://')
      ? new URL(trimmed)
      : new URL(trimmed, 'https://stecute.local')
    const match = url.pathname.match(/\/j\/([^/]+)\/?$/i)
    if (!match) return null

    return normalizeBoothCode(decodeURIComponent(match[1]))
  } catch {
    const match = trimmed.match(/\/j\/([^/?#]+)/i)
    return match ? normalizeBoothCode(decodeURIComponent(match[1])) : null
  }
}

export function createMemoryRegistry(): BoothRegistry {
  const rooms = new Map<string, BoothIdentity>()

  return {
    save(identity) {
      const normalized = normalizeBoothCode(identity.code)
      if (!normalized) {
        throw new Error('Cannot store an invalid booth identity.')
      }

      rooms.set(normalized, identity)
    },
    findByNormalizedCode(normalized) {
      return rooms.get(normalized)
    },
  }
}

export function createLocalStorageRegistry(storage: Storage): BoothRegistry {
  function read(): Record<string, StoredBooth> {
    try {
      const raw = storage.getItem(BOOTH_STORAGE_KEY)
      if (!raw) return {}

      const parsed = JSON.parse(raw) as Record<string, StoredBooth>
      const now = Date.now()
      const fresh: Record<string, StoredBooth> = {}

      for (const [key, value] of Object.entries(parsed)) {
        if (value && now - value.createdAt < BOOTH_TTL_MS) {
          fresh[key] = value
        }
      }

      return fresh
    } catch {
      return {}
    }
  }

  function write(rooms: Record<string, StoredBooth>) {
    storage.setItem(BOOTH_STORAGE_KEY, JSON.stringify(rooms))
  }

  return {
    save(identity) {
      const normalized = normalizeBoothCode(identity.code)
      if (!normalized) {
        throw new Error('Cannot store an invalid booth identity.')
      }

      const rooms = read()
      rooms[normalized] = { ...identity, createdAt: Date.now() }
      write(rooms)
    },
    findByNormalizedCode(normalized) {
      const stored = read()[normalized]
      if (!stored) return undefined

      return {
        boothId: stored.boothId,
        code: stored.code,
        invitePath: stored.invitePath,
      }
    },
  }
}

export function getBoothRegistry(): BoothRegistry {
  if (registryOverride) return registryOverride

  if (typeof localStorage !== 'undefined') {
    return createLocalStorageRegistry(localStorage)
  }

  memoryFallback ??= createMemoryRegistry()
  return memoryFallback
}

export function setBoothRegistry(registry: BoothRegistry | null) {
  registryOverride = registry
}

export function createBooth(
  registry: BoothRegistry = getBoothRegistry(),
  options: { boothId?: string; code?: string } = {},
): BoothIdentity {
  const normalized = options.code
    ? normalizeBoothCode(options.code)
    : uniqueNormalizedCode(registry)

  if (!normalized) {
    throw new Error('Cannot create a booth with an invalid code.')
  }

  const identity: BoothIdentity = {
    ...identityFromNormalizedCode(normalized),
    ...(options.boothId ? { boothId: options.boothId } : {}),
  }

  registry.save(identity)
  return identity
}

export function identityFromNormalizedCode(normalized: string): BoothIdentity {
  return {
    boothId: `booth-${normalized}`,
    code: formatBoothCode(normalized),
    invitePath: buildInvitePath(normalized),
  }
}

export function joinBoothByCode(
  code: string | null | undefined,
  registry: BoothRegistry = getBoothRegistry(),
): BoothJoinResult {
  if (code == null || !String(code).trim()) {
    return { ok: false, reason: 'missing' }
  }

  const normalized = normalizeBoothCode(code)
  if (!normalized) {
    return { ok: false, reason: 'malformed' }
  }

  return {
    ok: true,
    identity: registry.findByNormalizedCode(normalized) ?? identityFromNormalizedCode(normalized),
  }
}

export function joinBoothByInvite(
  urlOrPath: string | null | undefined,
  registry: BoothRegistry = getBoothRegistry(),
): BoothJoinResult {
  if (urlOrPath == null || !String(urlOrPath).trim()) {
    return { ok: false, reason: 'missing' }
  }

  const normalized = parseInviteCode(urlOrPath)
  if (!normalized) {
    return { ok: false, reason: 'malformed' }
  }

  return {
    ok: true,
    identity: registry.findByNormalizedCode(normalized) ?? identityFromNormalizedCode(normalized),
  }
}

export function buildInviteUrl(origin: string, identity: BoothIdentity): string {
  return new URL(identity.invitePath, origin.endsWith('/') ? origin : `${origin}/`).toString()
}

function uniqueNormalizedCode(registry: BoothRegistry): string {
  for (let attempt = 0; attempt < 32; attempt++) {
    const candidate = randomNormalizedCode()
    if (!registry.findByNormalizedCode(candidate)) return candidate
  }

  throw new Error('Unable to allocate a unique booth code.')
}

function randomNormalizedCode(): string {
  const bytes = new Uint8Array(BOOTH_CODE_LENGTH)

  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index++) {
      bytes[index] = Math.floor(Math.random() * 256)
    }
  }

  let code = ''
  for (const byte of bytes) {
    code += BOOTH_CODE_ALPHABET[byte % BOOTH_CODE_ALPHABET.length]
  }

  return code
}
