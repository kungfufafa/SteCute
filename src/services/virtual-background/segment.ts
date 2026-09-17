import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision'
import {
  composeVirtualBackground,
  type PersonMask,
  type RgbaFrame,
  type VirtualBackgroundSpec,
} from './compose'
import { getVirtualBackgroundById } from './catalog'

const MEDIAPIPE_ASSET_BASE_PATH = `${import.meta.env.BASE_URL}vendor/mediapipe`

export const PERSON_SEGMENTER_WASM_BASE_PATH = `${MEDIAPIPE_ASSET_BASE_PATH}/tasks-vision/wasm`
export const PERSON_SEGMENTER_MODEL_PATH = `${MEDIAPIPE_ASSET_BASE_PATH}/models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite`

type SegmenterDelegate = 'GPU' | 'CPU'
type VisionWasmFileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>
type SegmentableSource = HTMLVideoElement | HTMLCanvasElement | OffscreenCanvas | HTMLImageElement

export const WORKER_MAX_PREVIEW_SIDE = 720
export const WORKER_MIN_FRAME_INTERVAL_MS = 1000 / 15 // 15 fps (~66.6 ms)
export const MAIN_THREAD_MAX_PREVIEW_SIDE = 480
export const MAIN_THREAD_MIN_FRAME_INTERVAL_MS = 1000 / 10 // 10 fps (100 ms)

let imageSegmenter: ImageSegmenter | null = null
let initPromise: Promise<ImageSegmenter | null> | null = null
let lastSegmentationTimestamp = -1
let retainCount = 0

// Worker instance & state
let segmentWorker: Worker | null = null
let workerInitPromise: Promise<boolean> | null = null
let workerFrameIdCounter = 0
const workerPendingCallbacks = new Map<
  number,
  (result: { success: boolean; mask?: PersonMask; configRevision: number }) => void
>()

export function isPersonSegmenterReady(): boolean {
  return imageSegmenter !== null || segmentWorker !== null
}

export async function initPersonSegmenter(): Promise<boolean> {
  // Try worker first if supported
  const workerReady = await ensureWorkerSegmenter()
  if (workerReady) return true

  // Fallback to main thread segmenter
  const segmenter = await ensurePersonSegmenter()
  return segmenter !== null
}

export async function retainPersonSegmenter(): Promise<boolean> {
  retainCount += 1
  return initPersonSegmenter()
}

export function releasePersonSegmenter(): void {
  retainCount = Math.max(0, retainCount - 1)
  if (retainCount === 0) destroyPersonSegmenter()
}

export async function ensureWorkerSegmenter(): Promise<boolean> {
  if (segmentWorker) return true
  if (workerInitPromise) return workerInitPromise

  if (typeof Worker === 'undefined') return false

  workerInitPromise = (async () => {
    try {
      const worker = new Worker(new URL('../../workers/segment.worker.ts', import.meta.url), {
        type: 'module',
      })

      worker.onmessage = (event) => {
        const message = event.data
        if (!message || typeof message !== 'object') return

        if (message.type === 'segment-result') {
          const callback = workerPendingCallbacks.get(message.frameId)
          if (callback) {
            workerPendingCallbacks.delete(message.frameId)
            callback({
              success: Boolean(message.success),
              mask: message.mask,
              configRevision: message.configRevision,
            })
          }
        }
      }

      worker.onerror = () => {
        destroyWorker()
      }

      const initSuccess = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => resolve(false), 10_000)
        const listener = (event: MessageEvent) => {
          if (event.data?.type === 'init-result') {
            clearTimeout(timeout)
            worker.removeEventListener('message', listener)
            resolve(Boolean(event.data.success))
          }
        }
        worker.addEventListener('message', listener)
        worker.postMessage({
          type: 'init',
          wasmBasePath: PERSON_SEGMENTER_WASM_BASE_PATH,
          modelPath: PERSON_SEGMENTER_MODEL_PATH,
        })
      })

      if (initSuccess) {
        segmentWorker = worker
        return true
      }

      worker.terminate()
      workerInitPromise = null
      return false
    } catch {
      workerInitPromise = null
      return false
    }
  })()

  return workerInitPromise
}

function destroyWorker() {
  if (segmentWorker) {
    segmentWorker.postMessage({ type: 'close' })
    segmentWorker.terminate()
    segmentWorker = null
  }
  workerInitPromise = null
  const pendingCallbacks = [...workerPendingCallbacks.values()]
  workerPendingCallbacks.clear()
  for (const callback of pendingCallbacks) {
    callback({ success: false, configRevision: -1 })
  }
}

export async function ensurePersonSegmenter(): Promise<ImageSegmenter | null> {
  if (imageSegmenter) return imageSegmenter
  if (initPromise) return initPromise

  initPromise = (async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(PERSON_SEGMENTER_WASM_BASE_PATH)

      try {
        imageSegmenter = await createPersonSegmenter(vision, 'GPU')
      } catch {
        imageSegmenter = await createPersonSegmenter(vision, 'CPU')
      }

      return imageSegmenter
    } catch {
      initPromise = null
      imageSegmenter = null
      return null
    }
  })()

  return initPromise
}

function createPersonSegmenter(
  vision: VisionWasmFileset,
  delegate: SegmenterDelegate,
): Promise<ImageSegmenter> {
  return ImageSegmenter.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: PERSON_SEGMENTER_MODEL_PATH,
      delegate,
    },
    runningMode: 'VIDEO',
    outputCategoryMask: false,
    outputConfidenceMasks: true,
  })
}

export function segmentPerson(source: SegmentableSource): PersonMask | null {
  if (!imageSegmenter) return null

  const width = getSourceWidth(source)
  const height = getSourceHeight(source)
  if (width <= 0 || height <= 0) return null

  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const timestamp = now <= lastSegmentationTimestamp ? lastSegmentationTimestamp + 1 : now
  lastSegmentationTimestamp = timestamp

  try {
    const result = imageSegmenter.segmentForVideo(source, timestamp)
    const mask = readPersonMask(result)
    closeSegmenterResult(result)
    return mask
  } catch {
    return null
  }
}

export async function segmentPersonAsync(
  source: CanvasImageSource,
  options: {
    configRevision?: number
    timestamp?: number
  } = {},
): Promise<{ mask: PersonMask | null; configRevision: number }> {
  const revision = options.configRevision ?? 0
  const width = getSourceWidth(source as SegmentableSource)
  const height = getSourceHeight(source as SegmentableSource)
  if (width <= 0 || height <= 0) {
    return { mask: null, configRevision: revision }
  }

  // Try Worker first if available
  if (segmentWorker && typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(source)
      const frameId = ++workerFrameIdCounter
      const now =
        options.timestamp ?? (typeof performance !== 'undefined' ? performance.now() : Date.now())

      return await new Promise((resolve) => {
        workerPendingCallbacks.set(frameId, (res) => {
          if (res.success && res.mask) {
            resolve({ mask: res.mask, configRevision: res.configRevision })
          } else {
            resolve({ mask: null, configRevision: revision })
          }
        })

        segmentWorker!.postMessage(
          {
            type: 'segment',
            frameId,
            configRevision: revision,
            bitmap,
            timestamp: now,
          },
          [bitmap],
        )
      })
    } catch {
      // Fallback to main thread
    }
  }

  // Fallback to main thread
  const syncMask = segmentPerson(source as SegmentableSource)
  return { mask: syncMask, configRevision: revision }
}

export function destroyPersonSegmenter(): void {
  if (imageSegmenter) {
    imageSegmenter.close()
    imageSegmenter = null
  }
  initPromise = null
  lastSegmentationTimestamp = -1
  retainCount = 0
  destroyWorker()
}

export function applyVirtualBackgroundToCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  spec: VirtualBackgroundSpec,
  segment: (source: HTMLCanvasElement) => PersonMask | null = segmentPerson,
): boolean {
  const background = getVirtualBackgroundById(spec.id)
  if (background.mode === 'off') return false
  if (typeof ctx.getImageData !== 'function' || typeof ctx.putImageData !== 'function') {
    return false
  }

  const mask = segment(canvas)
  if (!mask) return false

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const composed = composeVirtualBackground(
    { width: imageData.width, height: imageData.height, data: imageData.data },
    mask,
    spec,
  )

  if (composed.data === imageData.data) return false

  const outputImgData = ctx.createImageData(composed.width, composed.height)
  outputImgData.data.set(composed.data)
  ctx.putImageData(outputImgData, 0, 0)

  return true
}

export function applyVirtualBackgroundOrPassthrough(
  source: RgbaFrame,
  mask: PersonMask | null | undefined,
  spec: VirtualBackgroundSpec,
): RgbaFrame {
  return composeVirtualBackground(source, mask, spec)
}

function readPersonMask(result: {
  categoryMask?: {
    width: number
    height: number
    getAsUint8Array: () => Uint8Array
    close?: () => void
  }
  confidenceMasks?: Array<{
    width: number
    height: number
    getAsFloat32Array: () => Float32Array
    close?: () => void
  }>
}): PersonMask | null {
  const personConfidence = result.confidenceMasks?.[1] ?? result.confidenceMasks?.[0]
  if (personConfidence) {
    const floats = personConfidence.getAsFloat32Array()
    const data = new Uint8Array(floats.length)
    for (let index = 0; index < floats.length; index++) {
      data[index] = Math.round(Math.min(1, Math.max(0, floats[index])) * 255)
    }

    return {
      width: personConfidence.width,
      height: personConfidence.height,
      data,
    }
  }

  if (result.categoryMask) {
    const copied = new Uint8Array(result.categoryMask.getAsUint8Array())
    const data = new Uint8Array(copied.length)
    for (let index = 0; index < copied.length; index++) {
      data[index] = copied[index] > 0 ? 255 : 0
    }
    return {
      width: result.categoryMask.width,
      height: result.categoryMask.height,
      data,
    }
  }

  return null
}

function closeSegmenterResult(result: {
  categoryMask?: { close?: () => void }
  confidenceMasks?: Array<{ close?: () => void }>
}) {
  result.categoryMask?.close?.()
  result.confidenceMasks?.forEach((mask) => mask.close?.())
}

function getSourceWidth(source: SegmentableSource): number {
  if ('videoWidth' in source) return source.videoWidth
  if ('naturalWidth' in source) return source.naturalWidth
  return source.width
}

function getSourceHeight(source: SegmentableSource): number {
  if ('videoHeight' in source) return source.videoHeight
  if ('naturalHeight' in source) return source.naturalHeight
  return source.height
}
