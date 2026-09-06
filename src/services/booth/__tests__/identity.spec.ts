import { describe, expect, it } from 'vitest'
import {
  buildInviteUrl,
  createBooth,
  createMemoryRegistry,
  joinBoothByCode,
  joinBoothByInvite,
  normalizeBoothCode,
} from '@/services/booth'

describe('booth identity', () => {
  it('creates a booth whose invite URL embeds the same join code', () => {
    const registry = createMemoryRegistry()
    const booth = createBooth(registry)

    expect(normalizeBoothCode(booth.code)).toHaveLength(6)
    expect(booth.invitePath).toBe(`/j/${booth.code}`)
    expect(booth.invitePath).toContain(booth.code)

    const inviteUrl = buildInviteUrl('https://stecute.example', booth)
    expect(inviteUrl).toBe(`https://stecute.example/j/${booth.code}`)
    expect(inviteUrl).toContain(booth.code)
  })

  it('resolves join-by-URL and join-by-code to the same booth id', () => {
    const registry = createMemoryRegistry()
    const booth = createBooth(registry)
    const compact = booth.code.replace('-', '')
    const mixedCase = `${compact.slice(0, 3).toLowerCase()}-${compact.slice(3).toLowerCase()}`

    const byFormattedCode = joinBoothByCode(booth.code, registry)
    const byCompactCode = joinBoothByCode(compact, registry)
    const byMixedCase = joinBoothByCode(mixedCase, registry)
    const byPath = joinBoothByInvite(booth.invitePath, registry)
    const byUrl = joinBoothByInvite(`https://stecute.example${booth.invitePath}?ref=chat`, registry)
    const byUnhyphenatedPath = joinBoothByInvite(`/j/${compact.toLowerCase()}`, registry)

    expect(byFormattedCode).toEqual({ ok: true, identity: booth })
    expect(byCompactCode.ok && byCompactCode.identity.boothId).toBe(booth.boothId)
    expect(byMixedCase.ok && byMixedCase.identity.boothId).toBe(booth.boothId)
    expect(byPath.ok && byPath.identity.boothId).toBe(booth.boothId)
    expect(byUrl.ok && byUrl.identity.boothId).toBe(booth.boothId)
    expect(byUnhyphenatedPath.ok && byUnhyphenatedPath.identity.boothId).toBe(booth.boothId)
  })

  it('rejects missing and malformed codes, and reconstructs a well-formed code without a local registry', () => {
    const registry = createMemoryRegistry()
    createBooth(registry)

    expect(joinBoothByCode('', registry)).toEqual({ ok: false, reason: 'missing' })
    expect(joinBoothByCode('   ', registry)).toEqual({ ok: false, reason: 'missing' })
    expect(joinBoothByCode(null, registry)).toEqual({ ok: false, reason: 'missing' })
    expect(joinBoothByInvite('', registry)).toEqual({ ok: false, reason: 'missing' })

    expect(joinBoothByCode('@@@', registry)).toEqual({ ok: false, reason: 'malformed' })
    expect(joinBoothByCode('AB', registry)).toEqual({ ok: false, reason: 'malformed' })
    expect(joinBoothByCode('ABCDEFG', registry)).toEqual({ ok: false, reason: 'malformed' })
    expect(joinBoothByCode('ABC0EF', registry)).toEqual({ ok: false, reason: 'malformed' })
    expect(joinBoothByInvite('/j/!!!', registry)).toEqual({ ok: false, reason: 'malformed' })
    expect(joinBoothByInvite('/gallery', registry)).toEqual({ ok: false, reason: 'malformed' })

    const reconstructed = joinBoothByCode('ZZZZZZ', registry)
    expect(reconstructed.ok).toBe(true)
    if (reconstructed.ok) {
      expect(reconstructed.identity.code).toBe('ZZZ-ZZZ')
      expect(reconstructed.identity.invitePath).toBe('/j/ZZZ-ZZZ')
    }
  })
})
