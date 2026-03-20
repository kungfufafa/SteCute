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

  it('accepts a single valid replacement file', () => {
    const result = validateFile(createFile('replace.webp', 'image/webp', 2048))

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })
})
