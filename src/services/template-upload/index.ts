import type { LayoutConfig, SlotConfig, TemplateConfig } from '@/db/schema'
import { TemplateRepository } from '@/db/repositories'

const ACCEPTED_TEMPLATE_TYPES = ['image/png', 'image/webp']
const MAX_TEMPLATE_SIZE = 10 * 1024 * 1024
const TARGET_CANVAS_WIDTH = 1200
const TRANSPARENT_ALPHA_THRESHOLD = 16
const CUSTOM_LAYOUT_ID = 'custom-strip-layout'
const MAX_DETECTED_WINDOWS = 12
const LOCAL_TEMPLATE_ASSET_URL = 'indexeddb://local-template-asset'

const templateRepo = new TemplateRepository()
export const CUSTOM_TEMPLATE_ID = 'custom-strip'

export interface TransparentWindow {
  x: number
  y: number
  width: number
  height: number
  area: number
}

export interface UploadedStripTemplate {
  template: TemplateConfig
  objectUrl: string
  assetBlob: Blob
}

export function openStripTemplatePicker(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/png,image/webp'
    input.onchange = () => {
      resolve(input.files?.[0] ?? null)
    }
    input.click()
  })
}

export async function createTemplateFromStripFile(params: {
  file: File
}): Promise<UploadedStripTemplate> {
  const { file } = params

  validateStripTemplateFile(file)

  const uploadId = createUploadId()
  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await loadImage(objectUrl, file.name)
    const alpha = readAlphaChannel(image)
    const windows = findTransparentWindows(alpha, image.naturalWidth, image.naturalHeight)

    if (windows.length === 0) {
      throw new Error('Blanko harus punya minimal 1 area foto transparan.')
    }

    if (windows.length > MAX_DETECTED_WINDOWS) {
      throw new Error(`Blanko maksimal ${MAX_DETECTED_WINDOWS} area foto transparan.`)
    }

    const scale = TARGET_CANVAS_WIDTH / image.naturalWidth
    const canvas = {
      width: TARGET_CANVAS_WIDTH,
      height: Math.round(image.naturalHeight * scale),
    }
    const slots = windows.map<SlotConfig>((window) => ({
      x: Math.round(window.x * scale),
      y: Math.round(window.y * scale),
      width: Math.round(window.width * scale),
      height: Math.round(window.height * scale),
      radius: 0,
    }))
    const layoutId = `${CUSTOM_LAYOUT_ID}-${uploadId}`
    const nativeLayout: LayoutConfig = {
      id: layoutId,
      name: `Custom ${windows.length} Foto`,
      slotCount: windows.length,
      printFormat: {
        id: layoutId,
        label: 'Custom',
        paperSize: `${windows.length} foto`,
        description: 'Blanko upload',
        fileSlug: `custom-${windows.length}-photo-strip`,
      },
      canvas,
      slots,
    }

    return {
      objectUrl,
      assetBlob: file,
      template: {
        id: `${CUSTOM_TEMPLATE_ID}-${uploadId}`,
        name: `Custom ${windows.length} Foto`,
        description: `Blanko upload lokal untuk ${windows.length} foto.`,
        background: '#ffffff',
        surfaceColor: '#ffffff',
        accentColor: '#ec4f8a',
        textColor: '#1f1b2d',
        preview: {
          thumbnailImage: objectUrl,
          background: '#ffffff',
        },
        blanko: {
          mode: 'image',
          backgroundImage: objectUrl,
          imageLayer: 'overlay',
          imageFit: 'stretch',
          pattern: 'paper',
          photoPadding: 0,
          photoRadius: 0,
          photoShadow: false,
        },
        nativeLayout,
        frameAsset: '',
        defaultFrameColor: '#ffffff',
        label: {
          text: '',
          fontSize: 40,
          align: 'center',
        },
        footerLogo: null,
        supports: {
          stickers: false,
          frameColor: false,
          dateTime: false,
          logoText: false,
        },
      },
    }
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    throw error
  }
}

export async function persistUploadedStripTemplate(uploaded: UploadedStripTemplate): Promise<void> {
  await templateRepo.upsert({
    id: uploaded.template.id,
    name: uploaded.template.name,
    version: '1',
    config: withTemplateAssetUrl(uploaded.template, LOCAL_TEMPLATE_ASSET_URL),
    isBundled: false,
    assetBlob: uploaded.assetBlob,
  })
}

export async function loadUploadedStripTemplates(): Promise<UploadedStripTemplate[]> {
  const records = await templateRepo.getAll()

  return records
    .filter((record) => !record.isBundled && record.assetBlob)
    .map((record) => {
      const objectUrl = URL.createObjectURL(record.assetBlob!)

      return {
        objectUrl,
        assetBlob: record.assetBlob!,
        template: withTemplateAssetUrl(record.config, objectUrl),
      }
    })
}

export function validateStripTemplateFile(file: File) {
  if (!ACCEPTED_TEMPLATE_TYPES.includes(file.type)) {
    throw new Error('Blanko harus berupa PNG atau WebP dengan area foto transparan.')
  }

  if (file.size > MAX_TEMPLATE_SIZE) {
    throw new Error('Ukuran blanko maksimal 10 MB.')
  }
}

export function findTransparentWindows(
  alpha: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
): TransparentWindow[] {
  const transparent = new Uint8Array(width * height)
  const visited = new Uint8Array(width * height)
  const minArea = Math.max(64, Math.floor(width * height * 0.01))
  const minWidth = Math.max(8, Math.floor(width * 0.08))
  const minHeight = Math.max(8, Math.floor(height * 0.04))

  for (let index = 0; index < alpha.length; index++) {
    if (alpha[index] < TRANSPARENT_ALPHA_THRESHOLD) {
      transparent[index] = 1
    }
  }

  const windows: TransparentWindow[] = []
  const queue: number[] = []

  for (let index = 0; index < transparent.length; index++) {
    if (!transparent[index] || visited[index]) continue

    let cursor = 0
    let area = 0
    let minX = width
    let maxX = 0
    let minY = height
    let maxY = 0
    let touchesEdge = false

    queue.length = 0
    queue.push(index)
    visited[index] = 1

    while (cursor < queue.length) {
      const current = queue[cursor++]
      const x = current % width
      const y = Math.floor(current / width)

      area++
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)

      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        touchesEdge = true
      }

      visitNeighbor(current - 1, x > 0)
      visitNeighbor(current + 1, x < width - 1)
      visitNeighbor(current - width, y > 0)
      visitNeighbor(current + width, y < height - 1)
    }

    const windowWidth = maxX - minX + 1
    const windowHeight = maxY - minY + 1

    if (!touchesEdge && area >= minArea && windowWidth >= minWidth && windowHeight >= minHeight) {
      windows.push({
        x: minX,
        y: minY,
        width: windowWidth,
        height: windowHeight,
        area,
      })
    }
  }

  return windows.sort((a, b) => a.y - b.y || a.x - b.x)

  function visitNeighbor(neighbor: number, canVisit: boolean) {
    if (!canVisit || visited[neighbor] || !transparent[neighbor]) return

    visited[neighbor] = 1
    queue.push(neighbor)
  }
}

function readAlphaChannel(image: HTMLImageElement): Uint8ClampedArray {
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  if (!ctx) throw new Error('Browser tidak bisa membaca blanko.')

  ctx.drawImage(image, 0, 0)

  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  const alpha = new Uint8ClampedArray(canvas.width * canvas.height)

  for (let source = 3, target = 0; source < pixels.length; source += 4, target++) {
    alpha[target] = pixels[source]
  }

  return alpha
}

function loadImage(src: string, filename: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Gagal membaca blanko "${filename}".`))
    image.src = src
  })
}

function withTemplateAssetUrl(template: TemplateConfig, assetUrl: string): TemplateConfig {
  return {
    ...template,
    preview: {
      ...template.preview,
      thumbnailImage: assetUrl,
    },
    blanko: {
      ...template.blanko,
      backgroundImage: assetUrl,
    },
  }
}

function createUploadId(): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`

  return random.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 36)
}
