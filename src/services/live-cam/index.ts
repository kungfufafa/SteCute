import type { DecorationConfig, LayoutConfig, Shot, SlotConfig, TemplateConfig } from '@/db/schema'
import { getObjectCoverCrop } from '@/services/camera/cover-crop'
import {
  drawCameraEffect,
  drawFaceTrackingEffect,
  isFaceTrackingEffect,
  preloadCameraEffectAssets,
  resolveFacesForSlotRender,
} from '@/services/camera-effects'
import { getPhotoFilterCanvas } from '@/services/filter'
import { renderStrip } from '@/services/render'
import { resolveTemplateLayout } from '@/templates'

const LIVE_CAM_RECORD_MIME_TYPES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
] as const
const LIVE_CAM_RENDER_MIME_TYPES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
] as const
const LIVE_STRIP_MAX_WIDTH = 720
const LIVE_STRIP_FPS = 24
const LIVE_STRIP_MAX_DURATION_MS = 4_000
const LIVE_STRIP_MIN_DURATION_MS = 1_200

export interface LiveCamClip {
  blob: Blob
  mimeType: string
  durationMs: number
  width: number
  height: number
  mirrored: boolean
}

export interface LiveCamRecording {
  stop: (delayMs?: number) => Promise<LiveCamClip | null>
}

export interface LiveStripRenderJob {
  layout: LayoutConfig
  template: TemplateConfig
  shots: Shot[]
  decoration: DecorationConfig
  baseImageBlob?: Blob
}

export interface LiveStripRenderResult {
  blob: Blob
  mimeType: string
  width: number
  height: number
  durationMs: number
}

interface DecodedImage {
  source: CanvasImageSource
  width: number
  height: number
  close?: () => void
}

interface PreparedLiveVideo {
  shot: Shot
  video: HTMLVideoElement
  url: string
}

function getSupportedMimeType(types: readonly string[]): string | null {
  if (typeof MediaRecorder === 'undefined') return null

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }

  return null
}

export function getLiveCamFileExtension(mimeType?: string | null): string {
  if (mimeType?.includes('mp4')) return 'mp4'

  return 'webm'
}

export function isLiveCamRecordingSupported(stream?: MediaStream | null): boolean {
  return Boolean(
    stream &&
      typeof MediaRecorder !== 'undefined' &&
      getSupportedMimeType(LIVE_CAM_RECORD_MIME_TYPES) &&
      stream.getVideoTracks().some((track) => track.readyState === 'live'),
  )
}

export function isLiveStripRenderingSupported(): boolean {
  if (typeof document === 'undefined' || typeof MediaRecorder === 'undefined') return false

  const canvas = document.createElement('canvas') as HTMLCanvasElement & {
    captureStream?: (frameRate?: number) => MediaStream
  }
  return Boolean(
    typeof canvas.captureStream === 'function' && getSupportedMimeType(LIVE_CAM_RENDER_MIME_TYPES),
  )
}

export function startLiveCamRecording(
  stream: MediaStream,
  options: { mirrored: boolean },
): LiveCamRecording | null {
  if (!isLiveCamRecordingSupported(stream)) return null

  const mimeType = getSupportedMimeType(LIVE_CAM_RECORD_MIME_TYPES)
  if (!mimeType) return null

  const chunks: Blob[] = []
  const startedAt = performance.now()
  const videoTrack = stream.getVideoTracks()[0]
  const settings = videoTrack?.getSettings()
  const width = Number(settings?.width) || 0
  const height = Number(settings?.height) || 0
  let stopped = false

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 2_500_000,
  })

  const stoppedResult = new Promise<LiveCamClip | null>((resolve) => {
    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    })

    recorder.addEventListener('stop', () => {
      const durationMs = Math.max(0, Math.round(performance.now() - startedAt))
      if (chunks.length === 0) {
        resolve(null)
        return
      }

      resolve({
        blob: new Blob(chunks, { type: mimeType }),
        mimeType,
        durationMs,
        width,
        height,
        mirrored: options.mirrored,
      })
    })

    recorder.addEventListener('error', () => resolve(null))
  })

  recorder.start(250)

  return {
    stop: async (delayMs = 0) => {
      if (stopped) return stoppedResult
      stopped = true

      if (delayMs > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, delayMs))
      }

      if (recorder.state !== 'inactive') {
        recorder.requestData()
        recorder.stop()
      }

      return stoppedResult
    },
  }
}

export function startPairLiveCamRecording(options: {
  localVideo: HTMLVideoElement
  remoteVideo: HTMLVideoElement | null
  width: number
  height: number
  localOnLeft: boolean
}): LiveCamRecording | null {
  if (!isLiveStripRenderingSupported()) return null
  if (options.localVideo.videoWidth < 2) return null

  const mimeType = getSupportedMimeType(LIVE_CAM_RECORD_MIME_TYPES)
  if (!mimeType) return null

  const width = Math.max(2, Math.floor(options.width))
  const height = Math.max(1, Math.floor(options.height))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const canvasWithStream = canvas as HTMLCanvasElement & {
    captureStream?: (frameRate?: number) => MediaStream
  }
  const stream = canvasWithStream.captureStream?.(LIVE_STRIP_FPS)
  if (!stream) return null

  const chunks: Blob[] = []
  const startedAt = performance.now()
  let stopped = false
  let frameId = 0

  const leftVideo = options.localOnLeft ? options.localVideo : options.remoteVideo
  const rightVideo = options.localOnLeft ? options.remoteVideo : options.localVideo
  const halfWidth = Math.floor(width / 2)

  function drawPairFrame() {
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, width, height)
    drawVideoCoverToRect(ctx, leftVideo, 0, 0, halfWidth, height)
    drawVideoCoverToRect(ctx, rightVideo, halfWidth, 0, width - halfWidth, height)
  }

  function loop() {
    if (stopped) return
    drawPairFrame()
    frameId = window.requestAnimationFrame(loop)
  }

  drawPairFrame()
  loop()

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 2_500_000,
  })

  const stoppedResult = new Promise<LiveCamClip | null>((resolve) => {
    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    })

    recorder.addEventListener('stop', () => {
      window.cancelAnimationFrame(frameId)
      for (const track of stream.getTracks()) track.stop()
      const durationMs = Math.max(0, Math.round(performance.now() - startedAt))
      if (chunks.length === 0) {
        resolve(null)
        return
      }

      resolve({
        blob: new Blob(chunks, { type: mimeType }),
        mimeType,
        durationMs,
        width,
        height,
        mirrored: false,
      })
    })

    recorder.addEventListener('error', () => {
      window.cancelAnimationFrame(frameId)
      resolve(null)
    })
  })

  recorder.start(250)

  return {
    stop: async (delayMs = 0) => {
      if (stopped) return stoppedResult
      stopped = true

      if (delayMs > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, delayMs))
      }

      if (recorder.state !== 'inactive') {
        recorder.requestData()
        recorder.stop()
      }

      return stoppedResult
    },
  }
}

function drawVideoCoverToRect(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement | null,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth) {
    ctx.fillStyle = '#111'
    ctx.fillRect(x, y, width, height)
    return
  }

  const crop = getObjectCoverCrop(video.videoWidth, video.videoHeight, width, height)
  ctx.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, x, y, width, height)
}

export async function renderLiveStrip(
  job: LiveStripRenderJob,
): Promise<LiveStripRenderResult | null> {
  const liveShots = job.shots.filter((shot) => shot.liveClipBlob)
  if (liveShots.length === 0 || !isLiveStripRenderingSupported()) return null

  const renderLayout = resolveTemplateLayout(job.layout, job.template)
  const scale = Math.min(1, LIVE_STRIP_MAX_WIDTH / renderLayout.canvas.width)
  const width = Math.max(1, Math.round(renderLayout.canvas.width * scale))
  const height = Math.max(1, Math.round(renderLayout.canvas.height * scale))
  const scaledSlots = renderLayout.slots.map((slot) => scaleSlot(slot, scale))
  const baseImageBlob =
    job.baseImageBlob ??
    (
      await renderStrip({
        layout: job.layout,
        template: job.template,
        shots: job.shots,
        decoration: job.decoration,
        format: 'image/png',
      })
    ).blob

  await preloadCameraEffectAssetsForLiveShots(job.decoration.cameraEffectId, job.shots)

  const baseImage = await decodeImageBlob(baseImageBlob)
  const videos = await Promise.all(liveShots.map(prepareLiveVideo))
  const durationMs = getLiveStripDuration(liveShots)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get live cam canvas context')

  const stream = canvas.captureStream(LIVE_STRIP_FPS)
  const mimeType = getSupportedMimeType(LIVE_CAM_RENDER_MIME_TYPES)
  if (!mimeType) return null

  const chunks: Blob[] = []
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 3_500_000,
  })

  try {
    await Promise.all(videos.map(({ video }) => startVideo(video)))

    const result = new Promise<LiveStripRenderResult>((resolve, reject) => {
      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) chunks.push(event.data)
      })

      recorder.addEventListener('stop', () => {
        if (chunks.length === 0) {
          reject(new Error('Live Cam recorder returned empty data'))
          return
        }

        resolve({
          blob: new Blob(chunks, { type: mimeType }),
          mimeType,
          width,
          height,
          durationMs,
        })
      })

      recorder.addEventListener('error', () => {
        reject(new Error('Live Cam render recorder failed'))
      })
    })

    recorder.start(250)
    const startedAt = performance.now()

    await new Promise<void>((resolve) => {
      const draw = () => {
        const elapsedMs = performance.now() - startedAt
        drawLiveStripFrame(ctx, {
          baseImage,
          width,
          height,
          slots: scaledSlots,
          videos,
          decoration: job.decoration,
          elapsedMs,
        })

        if (elapsedMs >= durationMs) {
          resolve()
          return
        }

        window.requestAnimationFrame(draw)
      }

      draw()
    })

    recorder.requestData()
    recorder.stop()

    return await result
  } finally {
    baseImage.close?.()
    videos.forEach(({ video, url }) => {
      video.pause()
      video.removeAttribute('src')
      URL.revokeObjectURL(url)
    })
    stream.getTracks().forEach((track) => track.stop())
  }
}

async function preloadCameraEffectAssetsForLiveShots(
  defaultEffectId: string | null | undefined,
  shots: Pick<Shot, 'cameraEffectId'>[],
) {
  const effectIds = new Set(
    shots
      .map((shot) => shot.cameraEffectId || defaultEffectId)
      .filter((effectId): effectId is string => Boolean(effectId) && effectId !== 'none'),
  )

  await Promise.all([...effectIds].map((effectId) => preloadCameraEffectAssets(effectId)))
}

function getLiveStripDuration(shots: Shot[]): number {
  const maxDuration = Math.max(...shots.map((shot) => shot.liveClipDurationMs ?? 0))
  return Math.min(
    LIVE_STRIP_MAX_DURATION_MS,
    Math.max(LIVE_STRIP_MIN_DURATION_MS, Math.round(maxDuration)),
  )
}

function scaleSlot(slot: SlotConfig, scale: number): SlotConfig {
  return {
    x: slot.x * scale,
    y: slot.y * scale,
    width: slot.width * scale,
    height: slot.height * scale,
    radius: slot.radius * scale,
  }
}

async function decodeImageBlob(blob: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob)
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    }
  }

  const url = URL.createObjectURL(blob)
  const image = new Image()
  image.decoding = 'async'
  image.src = url
  await image.decode()
  URL.revokeObjectURL(url)

  return {
    source: image,
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height,
  }
}

async function prepareLiveVideo(shot: Shot): Promise<PreparedLiveVideo> {
  if (!shot.liveClipBlob) throw new Error('Shot has no Live Cam clip')

  const url = URL.createObjectURL(shot.liveClipBlob)
  const video = document.createElement('video')
  video.src = url
  video.muted = true
  video.loop = true
  video.playsInline = true
  video.preload = 'auto'

  await waitForVideoMetadata(video)
  return { shot, video, url }
}

function waitForVideoMetadata(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', handleLoaded)
      video.removeEventListener('error', handleError)
    }
    const handleLoaded = () => {
      cleanup()
      resolve()
    }
    const handleError = () => {
      cleanup()
      reject(new Error('Live Cam clip failed to load'))
    }

    video.addEventListener('loadedmetadata', handleLoaded, { once: true })
    video.addEventListener('error', handleError, { once: true })
  })
}

async function startVideo(video: HTMLVideoElement): Promise<void> {
  try {
    video.currentTime = 0
  } catch {
    // Some browsers only allow seeking after playback starts.
  }

  await video.play()
}

function drawLiveStripFrame(
  ctx: CanvasRenderingContext2D,
  params: {
    baseImage: DecodedImage
    width: number
    height: number
    slots: SlotConfig[]
    videos: PreparedLiveVideo[]
    decoration: DecorationConfig
    elapsedMs: number
  },
) {
  ctx.clearRect(0, 0, params.width, params.height)
  ctx.drawImage(params.baseImage.source, 0, 0, params.width, params.height)

  for (const { shot, video } of params.videos) {
    const slot = params.slots[shot.order]
    if (!slot || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) continue

    ctx.save()
    clipRoundedRect(ctx, slot)

    ctx.filter =
      params.decoration.filterId && params.decoration.filterId !== 'normal'
        ? getPhotoFilterCanvas(params.decoration.filterId)
        : 'none'
    drawVideoCover(ctx, video, slot, shot.liveClipMirrored === true)
    ctx.filter = 'none'

    const effectId = shot.cameraEffectId || params.decoration.cameraEffectId
    if (effectId && effectId !== 'none') {
      ctx.save()
      ctx.translate(slot.x, slot.y)
      if (isFaceTrackingEffect(effectId)) {
        drawFaceTrackingEffect(
          ctx,
          slot.width,
          slot.height,
          effectId,
          resolveFacesForSlotRender(shot.faceBounds, slot, {
            width: shot.width,
            height: shot.height,
          }),
          { timeMs: (shot.cameraEffectFrameMs ?? 0) + params.elapsedMs },
        )
      } else {
        drawCameraEffect(ctx, slot.width, slot.height, effectId, {
          timeMs: (shot.cameraEffectFrameMs ?? 0) + params.elapsedMs,
        })
      }
      ctx.restore()
    }

    ctx.restore()
  }
}

function clipRoundedRect(ctx: CanvasRenderingContext2D, slot: SlotConfig) {
  const radius = Math.max(0, Math.min(slot.radius, slot.width / 2, slot.height / 2))
  ctx.beginPath()
  ctx.moveTo(slot.x + radius, slot.y)
  ctx.lineTo(slot.x + slot.width - radius, slot.y)
  ctx.quadraticCurveTo(slot.x + slot.width, slot.y, slot.x + slot.width, slot.y + radius)
  ctx.lineTo(slot.x + slot.width, slot.y + slot.height - radius)
  ctx.quadraticCurveTo(
    slot.x + slot.width,
    slot.y + slot.height,
    slot.x + slot.width - radius,
    slot.y + slot.height,
  )
  ctx.lineTo(slot.x + radius, slot.y + slot.height)
  ctx.quadraticCurveTo(slot.x, slot.y + slot.height, slot.x, slot.y + slot.height - radius)
  ctx.lineTo(slot.x, slot.y + radius)
  ctx.quadraticCurveTo(slot.x, slot.y, slot.x + radius, slot.y)
  ctx.closePath()
  ctx.clip()
}

function drawVideoCover(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  slot: SlotConfig,
  mirrored: boolean,
) {
  const sourceWidth = video.videoWidth
  const sourceHeight = video.videoHeight
  if (sourceWidth === 0 || sourceHeight === 0) return

  const sourceRatio = sourceWidth / sourceHeight
  const targetRatio = slot.width / slot.height
  let sx = 0
  let sy = 0
  let sw = sourceWidth
  let sh = sourceHeight

  if (sourceRatio > targetRatio) {
    sw = Math.round(sourceHeight * targetRatio)
    sx = Math.round((sourceWidth - sw) / 2)
  } else if (sourceRatio < targetRatio) {
    sh = Math.round(sourceWidth / targetRatio)
    sy = Math.round((sourceHeight - sh) / 2)
  }

  if (!mirrored) {
    ctx.drawImage(video, sx, sy, sw, sh, slot.x, slot.y, slot.width, slot.height)
    return
  }

  ctx.save()
  ctx.translate(slot.x + slot.width, slot.y)
  ctx.scale(-1, 1)
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, slot.width, slot.height)
  ctx.restore()
}
