import { readBlobAsArrayBuffer } from '@/utils/blob'

export interface UploadConstraints {
  maxFileSize: number // bytes
  maxFiles: number
  acceptedTypes: string[]
}

export const DEFAULT_UPLOAD_CONSTRAINTS: UploadConstraints = {
  maxFileSize: 10 * 1024 * 1024, // 10 MB
  maxFiles: 6,
  acceptedTypes: ['image/jpeg', 'image/png', 'image/webp'],
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export function validateFiles(files: File[], slotCount: number): ValidationResult {
  const errors: string[] = []
  const constraints = DEFAULT_UPLOAD_CONSTRAINTS

  if (files.length === 0) {
    return { valid: false, errors: ['Belum ada file yang dipilih.'] }
  }

  if (files.length > constraints.maxFiles) {
    errors.push(`Maksimal ${constraints.maxFiles} file per sesi. Kamu memilih ${files.length}.`)
  }

  if (files.length !== slotCount) {
    errors.push(`Layout ini membutuhkan tepat ${slotCount} foto. Kamu memilih ${files.length}.`)
  }

  for (const file of files) {
    if (!constraints.acceptedTypes.includes(file.type)) {
      errors.push(`"${file.name}" bukan format yang didukung. Gunakan JPG, PNG, atau WebP.`)
    }
    if (file.size > constraints.maxFileSize) {
      errors.push(`"${file.name}" melebihi batas ukuran 10 MB.`)
    }
  }

  return { valid: errors.length === 0, errors }
}

export function validateFile(file: File): ValidationResult {
  return validateFiles([file], 1)
}

export async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  const headerDimensions = await getImageDimensionsFromHeader(file)
  if (headerDimensions) return headerDimensions

  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      const dimensions = { width: bitmap.width, height: bitmap.height }
      bitmap.close()
      return dimensions
    } catch {
      // Fall back to object URL decoding for browsers with partial ImageBitmap support.
    }
  }

  return getImageDimensionsViaObjectUrl(file)
}

export async function createStoredImageBlob(file: File): Promise<Blob> {
  try {
    return new Blob([await readBlobAsArrayBuffer(file)], { type: file.type })
  } catch {
    return file.slice(0, file.size, file.type)
  }
}

async function getImageDimensionsFromHeader(
  file: File,
): Promise<{ width: number; height: number } | null> {
  const view = new DataView(await readBlobAsArrayBuffer(file))

  if (isPng(view)) {
    return {
      width: view.getUint32(16, false),
      height: view.getUint32(20, false),
    }
  }

  if (isJpeg(view)) {
    return getJpegDimensions(view)
  }

  if (isWebp(view)) {
    return getWebpDimensions(view)
  }

  return null
}

function isPng(view: DataView): boolean {
  return (
    view.byteLength >= 24 &&
    view.getUint32(0, false) === 0x89504e47 &&
    view.getUint32(4, false) === 0x0d0a1a0a
  )
}

function isJpeg(view: DataView): boolean {
  return view.byteLength >= 4 && view.getUint16(0, false) === 0xffd8
}

function getJpegDimensions(view: DataView): { width: number; height: number } | null {
  let offset = 2
  const sofMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ])

  while (offset + 9 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) {
      offset += 1
      continue
    }

    const marker = view.getUint8(offset + 1)
    const segmentLength = view.getUint16(offset + 2, false)

    if (sofMarkers.has(marker)) {
      return {
        height: view.getUint16(offset + 5, false),
        width: view.getUint16(offset + 7, false),
      }
    }

    if (segmentLength < 2) return null
    offset += 2 + segmentLength
  }

  return null
}

function isWebp(view: DataView): boolean {
  return view.byteLength >= 30 && readAscii(view, 0, 4) === 'RIFF' && readAscii(view, 8, 4) === 'WEBP'
}

function getWebpDimensions(view: DataView): { width: number; height: number } | null {
  let offset = 12

  while (offset + 8 <= view.byteLength) {
    const chunkType = readAscii(view, offset, 4)
    const chunkSize = view.getUint32(offset + 4, true)
    const dataOffset = offset + 8

    if (chunkType === 'VP8X' && dataOffset + 10 <= view.byteLength) {
      return {
        width: 1 + readUint24(view, dataOffset + 4),
        height: 1 + readUint24(view, dataOffset + 7),
      }
    }

    if (chunkType === 'VP8L' && dataOffset + 5 <= view.byteLength) {
      const bits = view.getUint32(dataOffset + 1, true)
      return {
        width: 1 + (bits & 0x3fff),
        height: 1 + ((bits >> 14) & 0x3fff),
      }
    }

    if (chunkType === 'VP8 ' && dataOffset + 10 <= view.byteLength) {
      return {
        width: view.getUint16(dataOffset + 6, true) & 0x3fff,
        height: view.getUint16(dataOffset + 8, true) & 0x3fff,
      }
    }

    offset = dataOffset + chunkSize + (chunkSize % 2)
  }

  return null
}

function readAscii(view: DataView, offset: number, length: number): string {
  let text = ''

  for (let index = 0; index < length; index++) {
    text += String.fromCharCode(view.getUint8(offset + index))
  }

  return text
}

function readUint24(view: DataView, offset: number): number {
  return view.getUint8(offset) | (view.getUint8(offset + 1) << 8) | (view.getUint8(offset + 2) << 16)
}

function getImageDimensionsViaObjectUrl(file: File): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file)

  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      })
    }

    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`Failed to decode ${file.name}`))
    }

    image.src = url
  })
}

export function openImagePicker(multiple: boolean = true): Promise<FileList | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/jpeg,image/png,image/webp'
    input.multiple = multiple
    input.onchange = () => {
      resolve(input.files)
    }
    input.click()
  })
}

export function loadImageAsBitmap(
  file: File,
): Promise<{ bitmap: ImageBitmap; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      createImageBitmap(img)
        .then((bitmap) => {
          URL.revokeObjectURL(url)
          resolve({ bitmap, width: img.naturalWidth, height: img.naturalHeight })
        })
        .catch((err) => {
          URL.revokeObjectURL(url)
          reject(err)
        })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`Failed to load image: ${file.name}`))
    }
    img.src = url
  })
}
