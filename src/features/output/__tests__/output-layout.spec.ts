import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('../OutputView.vue', import.meta.url)), 'utf8')

describe('output preview layout', () => {
  it('centers a photo-only result instead of leaving an empty Live Cam column', () => {
    const preview = source.slice(
      source.indexOf("{{ outputError ? 'Hasil Tidak Ditemukan' : 'Hasil' }}"),
      source.indexOf('outputActionError || outputActionNotice'),
    )

    expect(preview).toContain("'justify-center': !hasLiveCamOutput")
    expect(preview).toContain("hasLiveCamOutput ? 'max-w-4xl' : 'max-w-md'")
    expect(preview).not.toMatch(/md:grid-cols-2[\s\S]{0,120}md:grid-cols-1/)
    expect(preview).not.toContain('md:grid-cols-2')
  })
})
