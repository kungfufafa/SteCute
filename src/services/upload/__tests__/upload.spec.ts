import { describe, expect, it } from 'vitest'
import { validateFile, validateFiles } from '@/services/upload'

function createFile(
  name: string,
  type: string,
  size: number,
): File {
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
    expect(result.errors).toContain('"notes.txt" bukan format yang didukung. Gunakan JPG, PNG, atau WebP.')
    expect(result.errors).toContain('"large.png" melebihi batas ukuran 10 MB.')
  })

  it('accepts a single valid replacement file', () => {
    const result = validateFile(createFile('replace.webp', 'image/webp', 2048))

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })
})
