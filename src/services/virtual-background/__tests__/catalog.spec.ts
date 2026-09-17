import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  CUSTOM_BACKGROUND_MAX_BYTES,
  VIRTUAL_BACKGROUNDS,
  getVirtualBackgroundById,
  isVirtualBackgroundActive,
  normalizeVirtualBackgroundId,
  validateCustomBackgroundFile,
} from '@/services/virtual-background'

describe('virtual background catalog', () => {
  it('exposes off, studio colors including pink and blue, blur, and custom image', () => {
    expect(VIRTUAL_BACKGROUNDS.map((background) => background.id)).toEqual(
      expect.arrayContaining(['off', 'pink', 'blue', 'lilac', 'mint', 'cream', 'blur', 'custom']),
    )
    expect(getVirtualBackgroundById('pink').mode).toBe('color')
    expect(getVirtualBackgroundById('pink').color).toBe('#f472b6')
    expect(getVirtualBackgroundById('blue').mode).toBe('color')
    expect(getVirtualBackgroundById('blue').color).toBe('#38bdf8')
    expect(getVirtualBackgroundById('blur').mode).toBe('blur')
    expect(getVirtualBackgroundById('custom').mode).toBe('custom')
  })

  it('normalizes unknown ids to off', () => {
    expect(getVirtualBackgroundById('missing').id).toBe('off')
    expect(normalizeVirtualBackgroundId('missing')).toBe('off')
    expect(normalizeVirtualBackgroundId(null)).toBe('off')
    expect(normalizeVirtualBackgroundId('chroma-key')).toBe('off')
    expect(isVirtualBackgroundActive('pink')).toBe(true)
    expect(isVirtualBackgroundActive('unknown')).toBe(false)
  })

  it('rejects non JPG/PNG/WebP files and files over 10 MB, and accepts a small valid image', () => {
    expect(
      validateCustomBackgroundFile({ name: 'room.gif', type: 'image/gif', size: 1200 }),
    ).toEqual({
      valid: false,
      errors: ['"room.gif" bukan format yang didukung. Gunakan JPG, PNG, atau WebP.'],
    })
    expect(
      validateCustomBackgroundFile({
        name: 'huge.jpg',
        type: 'image/jpeg',
        size: CUSTOM_BACKGROUND_MAX_BYTES + 1,
      }),
    ).toEqual({
      valid: false,
      errors: ['"huge.jpg" melebihi batas ukuran 10 MB.'],
    })
    expect(
      validateCustomBackgroundFile({ name: 'studio.png', type: 'image/png', size: 2048 }),
    ).toEqual({ valid: true, errors: [] })
    expect(
      validateCustomBackgroundFile({ name: 'studio.webp', type: 'image/webp', size: 4096 }),
    ).toEqual({ valid: true, errors: [] })
    expect(
      validateCustomBackgroundFile({ name: 'studio.jpg', type: 'image/jpeg', size: 1024 }),
    ).toEqual({ valid: true, errors: [] })
  })

  it('exposes selectable virtual-background controls in camera and booth UI', () => {
    const cameraView = readFileSync(
      fileURLToPath(new URL('../../../features/camera/CameraView.vue', import.meta.url)),
      'utf8',
    )
    const decoration = readFileSync(
      fileURLToPath(new URL('../../../features/booth/BoothDecorationPicker.vue', import.meta.url)),
      'utf8',
    )
    const picker = readFileSync(
      fileURLToPath(new URL('../../../components/common/VirtualBackgroundPicker.vue', import.meta.url)),
      'utf8',
    )

    expect(cameraView).toContain('Latar Virtual')
    expect(cameraView).toContain('VirtualBackgroundPicker')
    expect(decoration).toContain('kind === \'background\'')
    expect(picker).toContain('Pilih latar ${background.label}')
    expect(picker).toContain('VIRTUAL_BACKGROUNDS')
    expect(picker).toContain("'off'")
    expect(picker).toContain("'pink'")
    expect(picker).toContain("'blue'")
    expect(picker).toContain("'blur'")
    expect(picker).toContain("'custom'")
  })
})
