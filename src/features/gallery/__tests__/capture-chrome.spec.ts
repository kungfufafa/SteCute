import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

function readSource(relativePath: string) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

describe('capture chrome density', () => {
  it('keeps session settings compact instead of repeating titles and lock essays', () => {
    const settings = readSource('../../../components/common/CaptureSessionSettings.vue')
    expect(settings).not.toContain('>Pengaturan sesi</h2>')
    expect(settings).not.toContain(
      'Pengaturan dikunci setelah foto pertama agar semua foto konsisten',
    )
    expect(settings).not.toContain('Pengaturan bisa diubah sebelum foto pertama diambil')
    expect(settings).toContain('Ubah pengaturan sesi')
    expect(settings).toContain('capture-session-locked')
  })

  it('does not add extra look-and-feel headings on camera and booth', () => {
    const camera = readSource('../../camera/CameraView.vue')
    const booth = readSource('../../booth/BoothRoomView.vue')
    expect(camera).not.toContain('Tampilan foto')
    expect(booth).not.toContain('Tampilan foto')
    expect(booth).not.toContain('Sesi bersama')
    expect(booth).not.toContain('Frame dan efek mengikuti pilihan host')
    expect(booth).not.toContain('Siapkan posemu')
  })
})
