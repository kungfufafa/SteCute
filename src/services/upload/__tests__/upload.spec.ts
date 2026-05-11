import { describe, expect, it } from 'vitest'
import {
  clampUploadImageAdjustment,
  getAdjustedCropRect,
  getImageDimensions,
  validateFile,
  validateFiles,
} from '@/services/upload'

function createFile(name: string, type: string, size: number): File {
  return { name, type, size } as File
}

describe('upload validation', () => {
  it('requires the exact file count for the active layout', () => {
    const files = [
      createFile('one.jpg', 'image/jpeg', 1024),
      createFile('two.jpg', 'image/jpeg', 1024),
      createFile('three.jpg', 'image/jpeg', 1024),
    ]

    const result = validateFiles(files, 2)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Layout ini membutuhkan tepat 2 foto. Kamu memilih 3.')
  })

  it('returns localized validation errors for unsupported or oversized files', () => {
    const result = validateFiles(
      [
        createFile('notes.txt', 'text/plain', 1024),
        createFile('large.png', 'image/png', 11 * 1024 * 1024),
      ],
      2,
    )

    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      '"notes.txt" bukan format yang didukung. Gunakan JPG, PNG, atau WebP.',
    )
    expect(result.errors).toContain('"large.png" melebihi batas ukuran 10 MB.')
  })

  it('accepts a single valid replacement file', () => {
    const result = validateFile(createFile('replace.webp', 'image/webp', 2048))

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('allows template-defined upload sessions with more than six slots', () => {
    const files = Array.from({ length: 8 }, (_, index) =>
      createFile(`custom-${index + 1}.png`, 'image/png', 2048),
    )

    const result = validateFiles(files, 8)

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('reads PNG dimensions from the file header', async () => {
    const pngHeader = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
      0x52, 0x00, 0x00, 0x02, 0x80, 0x00, 0x00, 0x01, 0xe0,
    ])
    const file = new File([pngHeader], 'fixture.png', { type: 'image/png' })

    await expect(getImageDimensions(file)).resolves.toEqual({ width: 640, height: 480 })
  })

  it('calculates a centered crop that matches the target slot ratio', () => {
    const crop = getAdjustedCropRect(1200, 1600, 1080, 810, {
      fit: 'cover',
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    })

    expect(crop).toEqual({
      sx: 0,
      sy: 350,
      sw: 1200,
      sh: 900,
    })
  })

  it('clamps upload framing controls to the supported range', () => {
    expect(clampUploadImageAdjustment({ zoom: 10, offsetX: -2, offsetY: 2 })).toEqual({
      fit: 'cover',
      zoom: 3,
      offsetX: -1,
      offsetY: 1,
    })
  })
})
