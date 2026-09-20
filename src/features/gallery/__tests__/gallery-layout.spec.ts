import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('../GalleryView.vue', import.meta.url)), 'utf8')

describe('gallery page chrome', () => {
  it('does not repeat Galeri with a stored-on-device intro block', () => {
    expect(source).not.toContain('Tersimpan di perangkat')
    expect(source).not.toContain('Hasil terakhir')
    expect(source).not.toContain('Yang lama terhapus otomatis')
    expect(source).toContain('GALLERY_RETENTION_LIMIT')
    expect(source).toContain('Kosongkan')
  })
})
