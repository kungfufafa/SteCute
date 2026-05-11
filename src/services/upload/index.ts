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

const HEADER_READ_BYTES = 256 * 1024
const DEFAULT_ADJUSTED_IMAGE_TYPE = 'image/jpeg'
const DEFAULT_ADJUSTED_IMAGE_QUALITY = 0.92

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export interface UploadImageAdjustment {
  fit: 'cover' | 'contain'
  zoom: number
  offsetX: number
  offsetY: number
}

export interface AdjustedImageOptions {
  targetWidth: number
  targetHeight: number
  adjustment: UploadImageAdjustment
  type?: 'image/jpeg' | 'image/png' | 'image/webp'
  quality?: number
}

export interface CropRect {
  sx: number
  sy: number
  sw: number
  sh: number
}

interface DecodedUploadImage {
  source: CanvasImageSource
  width: number
  height: number
  cleanup: () => void
}

export const DEFAULT_UPLOAD_IMAGE_ADJUSTMENT: UploadImageAdjustment = {
  fit: 'cover',
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
}

export function createAutoUploadImageAdjustment(
  imageWidth: number,
  imageHeight: number,
  targetWidth: number,
  targetHeight: number,
): UploadImageAdjustment {
  const imageRatio = imageWidth / imageHeight
  const targetRatio = targetWidth / targetHeight

  if (imageRatio < targetRatio * 0.72) {
    return {
      fit: 'cover',
      zoom: 1.08,
      offsetX: 0,
      offsetY: -0.42,
    }
  }

  if (imageRatio < targetRatio * 0.92) {
    return {
      fit: 'cover',
      zoom: 1.02,
      offsetX: 0,
      offsetY: -0.24,
    }
  }

  return { ...DEFAULT_UPLOAD_IMAGE_ADJUSTMENT }
}

export function validateFiles(files: File[], slotCount: number): ValidationResult {
  const errors: string[] = []
  const constraints = DEFAULT_UPLOAD_CONSTRAINTS
  const maxFiles = Math.max(constraints.maxFiles, slotCount)

  if (files.length === 0) {
    return { valid: false, errors: ['Belum ada file yang dipilih.'] }
  }

  if (files.length > maxFiles) {
    errors.push(`Maksimal ${maxFiles} file per sesi. Kamu memilih ${files.length}.`)
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
  if (file.type === 'image/jpeg') {
    const decodedDimensions = await getImageDimensionsFromDecode(file)
    if (decodedDimensions) return decodedDimensions
  }

  const headerDimensions = await getImageDimensionsFromHeader(file)
  if (headerDimensions) return headerDimensions

  const decodedDimensions = await getImageDimensionsFromDecode(file)
  if (decodedDimensions) return decodedDimensions

  return getImageDimensionsViaObjectUrl(file)
}

async function getImageDimensionsFromDecode(
  file: File,
): Promise<{ width: number; height: number } | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      const dimensions = { width: bitmap.width, height: bitmap.height }
      bitmap.close()
      return dimensions
    } catch {
      // Fall back to object URL decoding for browsers with partial ImageBitmap support.
    }
  }

  return null
}

export async function createStoredImageBlob(file: File): Promise<Blob> {
  try {
    return new Blob([await readBlobAsArrayBuffer(file)], { type: file.type })
  } catch {
    return file.slice(0, file.size, file.type)
  }
}

export function clampUploadImageAdjustment(
  adjustment: Partial<UploadImageAdjustment> | undefined,
): UploadImageAdjustment {
  return {
    fit: adjustment?.fit === 'contain' ? 'contain' : DEFAULT_UPLOAD_IMAGE_ADJUSTMENT.fit,
    zoom: clamp(adjustment?.zoom ?? DEFAULT_UPLOAD_IMAGE_ADJUSTMENT.zoom, 1, 3),
    offsetX: clamp(adjustment?.offsetX ?? DEFAULT_UPLOAD_IMAGE_ADJUSTMENT.offsetX, -1, 1),
    offsetY: clamp(adjustment?.offsetY ?? DEFAULT_UPLOAD_IMAGE_ADJUSTMENT.offsetY, -1, 1),
  }
}

export function getAdjustedCropRect(
  imageWidth: number,
  imageHeight: number,
  targetWidth: number,
  targetHeight: number,
  adjustment: Partial<UploadImageAdjustment> | undefined,
): CropRect {
  const normalized = clampUploadImageAdjustment(adjustment)
  const targetRatio = targetWidth / targetHeight
  const imageRatio = imageWidth / imageHeight

  let baseCropWidth = imageWidth
  let baseCropHeight = imageHeight

  if (imageRatio > targetRatio) {
    baseCropWidth = imageHeight * targetRatio
  } else {
    baseCropHeight = imageWidth / targetRatio
  }

  const sw = Math.min(imageWidth, baseCropWidth / normalized.zoom)
  const sh = Math.min(imageHeight, baseCropHeight / normalized.zoom)
  const maxSx = Math.max(0, imageWidth - sw)
  const maxSy = Math.max(0, imageHeight - sh)
  const sx = clamp(maxSx / 2 + (normalized.offsetX * maxSx) / 2, 0, maxSx)
  const sy = clamp(maxSy / 2 + (normalized.offsetY * maxSy) / 2, 0, maxSy)

  return { sx, sy, sw, sh }
}

export async function createAdjustedImageBlob(
  file: File,
  options: AdjustedImageOptions,
): Promise<{ blob: Blob; width: number; height: number }> {
  const image = await decodeUploadImage(file)

  try {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(options.targetWidth))
    canvas.height = Math.max(1, Math.round(options.targetHeight))

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Gagal menyiapkan kanvas untuk framing foto.')

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    const type = options.type ?? DEFAULT_ADJUSTED_IMAGE_TYPE
    if (type === 'image/jpeg') {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    const adjustment = clampUploadImageAdjustment(options.adjustment)

    if (adjustment.fit === 'contain') {
      drawContainedImage(ctx, image, canvas.width, canvas.height)
    } else {
      const crop = getAdjustedCropRect(
        image.width,
        image.height,
        canvas.width,
        canvas.height,
        adjustment,
      )

      ctx.drawImage(
        image.source,
        crop.sx,
        crop.sy,
        crop.sw,
        crop.sh,
        0,
        0,
        canvas.width,
        canvas.height,
      )
    }

    const blob = await canvasToBlob(canvas, type, options.quality ?? DEFAULT_ADJUSTED_IMAGE_QUALITY)

    return { blob, width: canvas.width, height: canvas.height }
  } finally {
    image.cleanup()
  }
}

async function getImageDimensionsFromHeader(
  file: File,
): Promise<{ width: number; height: number } | null> {
  const headerBlob = file.slice(0, Math.min(file.size, HEADER_READ_BYTES), file.type)
  const view = new DataView(await readBlobAsArrayBuffer(headerBlob))

  if (isPng(view)) {
    return {
      width: view.getUint32(16, false),
      height: view.getUint32(20, false),
    }
  }

  if (isJpeg(view)) {
    const dimensions = getJpegDimensions(view)

    if (dimensions || file.size <= HEADER_READ_BYTES) return dimensions

    return getJpegDimensions(new DataView(await readBlobAsArrayBuffer(file)))
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
  return (
    view.byteLength >= 30 && readAscii(view, 0, 4) === 'RIFF' && readAscii(view, 8, 4) === 'WEBP'
  )
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
  return (
    view.getUint8(offset) | (view.getUint8(offset + 1) << 8) | (view.getUint8(offset + 2) << 16)
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function drawContainedImage(
  ctx: CanvasRenderingContext2D,
  image: DecodedUploadImage,
  width: number,
  height: number,
) {
  ctx.fillStyle = '#fff7fa'
  ctx.fillRect(0, 0, width, height)

  const backgroundCrop = getAdjustedCropRect(image.width, image.height, width, height, {
    fit: 'cover',
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
  })

  ctx.save()
  ctx.globalAlpha = 0.2
  ctx.filter = 'blur(18px) saturate(1.05)'
  ctx.drawImage(
    image.source,
    backgroundCrop.sx,
    backgroundCrop.sy,
    backgroundCrop.sw,
    backgroundCrop.sh,
    -32,
    -32,
    width + 64,
    height + 64,
  )
  ctx.restore()

  const scale = Math.min(width / image.width, height / image.height)
  const drawWidth = image.width * scale
  const drawHeight = image.height * scale
  const drawX = (width - drawWidth) / 2
  const drawY = (height - drawHeight) / 2

  ctx.drawImage(image.source, 0, 0, image.width, image.height, drawX, drawY, drawWidth, drawHeight)
}

async function decodeUploadImage(file: File): Promise<DecodedUploadImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      }
    } catch {
      // Fall back to HTMLImageElement decoding for browsers with partial ImageBitmap support.
    }
  }

  const url = URL.createObjectURL(file)

  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => {
      resolve({
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        cleanup: () => URL.revokeObjectURL(url),
      })
    }

    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`Failed to decode ${file.name}`))
    }

    image.src = url
  })
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: 'image/jpeg' | 'image/png' | 'image/webp',
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
          return
        }

        reject(new Error('Gagal membuat file foto hasil framing.'))
      },
      type,
      quality,
    )
  })
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
