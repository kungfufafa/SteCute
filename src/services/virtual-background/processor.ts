import { getObjectCoverCrop } from '@/services/camera/cover-crop'
import type { CapturedFrame } from '@/services/camera'
import { isVirtualBackgroundActive, normalizeVirtualBackgroundId } from './catalog'
import { composeVirtualBackground, type VirtualBackgroundSpec } from './compose'
import {
  ensureWorkerSegmenter,
  MAIN_THREAD_MAX_PREVIEW_SIDE,
  MAIN_THREAD_MIN_FRAME_INTERVAL_MS,
  releasePersonSegmenter,
  retainPersonSegmenter,
  segmentPersonAsync,
  WORKER_MAX_PREVIEW_SIDE,
  WORKER_MIN_FRAME_INTERVAL_MS,
} from './segment'

export type BackgroundProcessorStatus = 'off' | 'loading' | 'ready' | 'error'

export interface CameraBackgroundProcessorOptions {
  video: HTMLVideoElement
  rawStream?: MediaStream | null
  mirrored?: boolean
  onStatusChange?: (status: BackgroundProcessorStatus, error?: string | null) => void
}

export interface CameraBackgroundProcessorLike {
  readonly canvas: HTMLCanvasElement
  readonly currentStatus: BackgroundProcessorStatus
  readonly error: string | null
  readonly stream: MediaStream | null
  isActive(): boolean
  configure(spec: VirtualBackgroundSpec, options?: { mirrored?: boolean }): Promise<void>
  captureStill(options?: {
    mirrored?: boolean
    width?: number
    height?: number
  }): Promise<CapturedFrame>
  dispose(): void
}

export class CameraBackgroundProcessor implements CameraBackgroundProcessorLike {
  private video: HTMLVideoElement
  private rawStream: MediaStream | null
  private previewCanvas: HTMLCanvasElement
  private previewCtx: CanvasRenderingContext2D | null
  private offscreenCanvas: HTMLCanvasElement
  private offscreenCtx: CanvasRenderingContext2D | null
  private processedStream: MediaStream | null = null

  private currentSpec: VirtualBackgroundSpec = { id: 'off' }
  private mirrored: boolean = false
  private status: BackgroundProcessorStatus = 'off'
  private errorMessage: string | null = null

  private configRevision: number = 0
  private isInferring: boolean = false
  private shutterPriority: boolean = false
  private isUsingWorker: boolean = false

  private animFrameId: number | null = null
  private lastInferenceTime: number = 0
  private retainedSegmenter: boolean = false
  private isDisposed: boolean = false
  private onStatusChange?: (status: BackgroundProcessorStatus, error?: string | null) => void

  constructor(options: CameraBackgroundProcessorOptions) {
    this.video = options.video
    this.rawStream = options.rawStream ?? null
    this.mirrored = Boolean(options.mirrored)
    this.onStatusChange = options.onStatusChange

    this.previewCanvas = document.createElement('canvas')
    this.previewCanvas.width = 640
    this.previewCanvas.height = 480
    this.previewCtx = this.previewCanvas.getContext('2d', { willReadFrequently: true })

    this.offscreenCanvas = document.createElement('canvas')
    this.offscreenCanvas.width = 640
    this.offscreenCanvas.height = 480
    this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true })
  }

  public get canvas(): HTMLCanvasElement {
    return this.previewCanvas
  }

  public get currentStatus(): BackgroundProcessorStatus {
    return this.status
  }

  public get error(): string | null {
    return this.errorMessage
  }

  public get stream(): MediaStream | null {
    if (!this.isActive()) {
      return this.rawStream
    }

    if (!this.processedStream) {
      try {
        if (typeof this.previewCanvas.captureStream === 'function') {
          this.processedStream = this.previewCanvas.captureStream(15)
        }
      } catch {
        this.processedStream = null
      }
    }

    return this.processedStream ?? this.rawStream
  }

  public isActive(): boolean {
    return isVirtualBackgroundActive(this.currentSpec.id) && this.status !== 'error'
  }

  public async configure(
    spec: VirtualBackgroundSpec,
    options: { mirrored?: boolean } = {},
  ): Promise<void> {
    if (this.isDisposed) return

    this.configRevision += 1
    this.currentSpec = {
      id: normalizeVirtualBackgroundId(spec.id),
      customImage: spec.customImage ?? null,
    }

    if (options.mirrored !== undefined) {
      this.mirrored = options.mirrored
    }

    if (!isVirtualBackgroundActive(this.currentSpec.id)) {
      this.setStatus('off')
      this.stopLoop()
      this.releaseSegmenter()
      return
    }

    // Background is active
    this.setStatus('loading')
    let retainedForAttempt = false
    try {
      if (!this.retainedSegmenter) {
        retainedForAttempt = true
        const ready = await retainPersonSegmenter()
        if (!ready) {
          throw new Error('Gagal menyiapkan segmentasi latar belakang.')
        }
        this.retainedSegmenter = true
      }

      this.isUsingWorker = await ensureWorkerSegmenter()
      this.startLoop()
    } catch (err) {
      if (retainedForAttempt) {
        if (this.retainedSegmenter) {
          this.releaseSegmenter()
        } else {
          releasePersonSegmenter()
        }
      }
      const msg = err instanceof Error ? err.message : 'Gagal menyiapkan segmentasi latar belakang.'
      this.setStatus('error', msg)
      this.stopLoop()
    }
  }

  public setMirrored(mirrored: boolean): void {
    this.mirrored = mirrored
  }

  public setRawStream(stream: MediaStream | null): void {
    this.rawStream = stream
  }

  public async captureStill(
    options: { mirrored?: boolean; width?: number; height?: number } = {},
  ): Promise<CapturedFrame> {
    if (this.video.videoWidth === 0 || this.video.videoHeight === 0) {
      throw new Error('Camera preview is not ready yet')
    }

    const mirrored = options.mirrored ?? this.mirrored
    const targetAspect = options.width && options.height ? options.width / options.height : 4 / 3
    const vWidth = this.video.videoWidth
    const vHeight = this.video.videoHeight

    // Standard photo crop
    let sw = vWidth
    let sh = vHeight
    let sx = 0
    let sy = 0
    const sourceRatio = vWidth / vHeight
    if (sourceRatio > targetAspect) {
      sw = Math.round(vHeight * targetAspect)
      sx = Math.round((vWidth - sw) / 2)
    } else if (sourceRatio < targetAspect) {
      sh = Math.round(vWidth / targetAspect)
      sy = Math.round((vHeight - sh) / 2)
    }

    const stillCanvas = document.createElement('canvas')
    stillCanvas.width = sw
    stillCanvas.height = sh
    const stillCtx = stillCanvas.getContext('2d', { willReadFrequently: true })
    if (!stillCtx) throw new Error('Failed to get canvas context for still')

    // 1. Crop & 2. Mirror camera if needed
    if (mirrored) {
      stillCtx.save()
      stillCtx.translate(sw, 0)
      stillCtx.scale(-1, 1)
      stillCtx.drawImage(this.video, sx, sy, sw, sh, 0, 0, sw, sh)
      stillCtx.restore()
    } else {
      stillCtx.drawImage(this.video, sx, sy, sw, sh, 0, 0, sw, sh)
    }

    // If background is off or error, return raw cropped still
    if (!this.isActive()) {
      return new Promise<CapturedFrame>((resolve, reject) => {
        stillCanvas.toBlob(
          (blob) => {
            if (blob) resolve({ blob, width: sw, height: sh })
            else reject(new Error('Failed to encode captured still'))
          },
          'image/jpeg',
          0.92,
        )
      })
    }

    // Background active: Prioritize shutter inference
    this.shutterPriority = true
    try {
      // Wait if inference is in-flight
      let waitCount = 0
      while (this.isInferring && waitCount < 10) {
        await new Promise((r) => setTimeout(r, 15))
        waitCount++
      }

      // Segment still frame directly on the cropped & mirrored image. The
      // preview normally uses the worker, so use the same async path here.
      const { mask, configRevision } = await segmentPersonAsync(stillCanvas, {
        configRevision: this.configRevision,
      })
      if (mask && configRevision === this.configRevision) {
        const stillImageData = stillCtx.getImageData(0, 0, sw, sh)
        const composed = composeVirtualBackground(
          { width: sw, height: sh, data: stillImageData.data },
          mask,
          this.currentSpec,
        )

        const outputImgData = stillCtx.createImageData(sw, sh)
        outputImgData.data.set(composed.data)
        stillCtx.putImageData(outputImgData, 0, 0)
      }

      return await new Promise<CapturedFrame>((resolve, reject) => {
        stillCanvas.toBlob(
          (blob) => {
            if (blob) resolve({ blob, width: sw, height: sh })
            else reject(new Error('Failed to encode captured still'))
          },
          'image/jpeg',
          0.92,
        )
      })
    } finally {
      this.shutterPriority = false
    }
  }

  public dispose(): void {
    this.isDisposed = true
    this.stopLoop()
    this.releaseSegmenter()
    if (this.processedStream) {
      this.processedStream.getTracks().forEach((track) => track.stop())
      this.processedStream = null
    }
    this.setStatus('off')
  }

  private setStatus(status: BackgroundProcessorStatus, error: string | null = null) {
    if (this.status === status && this.errorMessage === error) return
    this.status = status
    this.errorMessage = error
    this.onStatusChange?.(status, error)
  }

  private startLoop() {
    if (this.animFrameId !== null) return
    this.loop()
  }

  private stopLoop() {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId)
      this.animFrameId = null
    }
  }

  private releaseSegmenter() {
    if (this.retainedSegmenter) {
      this.retainedSegmenter = false
      releasePersonSegmenter()
    }
  }

  private loop = () => {
    if (this.isDisposed) return
    this.animFrameId = requestAnimationFrame(async () => {
      await this.processPreviewFrame()
      this.loop()
    })
  }

  private async processPreviewFrame(): Promise<void> {
    if (!this.isActive() || this.shutterPriority) return
    if (this.video.videoWidth <= 0 || this.video.videoHeight <= 0) return

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const minInterval = this.isUsingWorker
      ? WORKER_MIN_FRAME_INTERVAL_MS
      : MAIN_THREAD_MIN_FRAME_INTERVAL_MS

    if (now - this.lastInferenceTime < minInterval) return
    if (this.isInferring) return // Only 1 inference in flight

    const maxSide = this.isUsingWorker ? WORKER_MAX_PREVIEW_SIDE : MAIN_THREAD_MAX_PREVIEW_SIDE

    const vWidth = this.video.videoWidth
    const vHeight = this.video.videoHeight

    // Target preview dimensions (maintaining 4:3 standard aspect ratio)
    const targetAspect = 4 / 3
    let targetWidth = maxSide
    let targetHeight = Math.round(maxSide / targetAspect)
    if (targetHeight > maxSide) {
      targetHeight = maxSide
      targetWidth = Math.round(maxSide * targetAspect)
    }

    if (this.previewCanvas.width !== targetWidth || this.previewCanvas.height !== targetHeight) {
      this.previewCanvas.width = targetWidth
      this.previewCanvas.height = targetHeight
      this.offscreenCanvas.width = targetWidth
      this.offscreenCanvas.height = targetHeight
    }

    const offCtx = this.offscreenCtx
    const prevCtx = this.previewCtx
    if (!offCtx || !prevCtx) return

    // 1. Crop video to target preview aspect ratio
    const crop = getObjectCoverCrop(vWidth, vHeight, targetWidth, targetHeight)

    // 2. Mirror camera if front-facing
    offCtx.clearRect(0, 0, targetWidth, targetHeight)
    if (this.mirrored) {
      offCtx.save()
      offCtx.translate(targetWidth, 0)
      offCtx.scale(-1, 1)
      offCtx.drawImage(
        this.video,
        crop.sx,
        crop.sy,
        crop.sw,
        crop.sh,
        0,
        0,
        targetWidth,
        targetHeight,
      )
      offCtx.restore()
    } else {
      offCtx.drawImage(
        this.video,
        crop.sx,
        crop.sy,
        crop.sw,
        crop.sh,
        0,
        0,
        targetWidth,
        targetHeight,
      )
    }

    const currentRev = this.configRevision
    this.isInferring = true
    this.lastInferenceTime = now

    try {
      // 3. Segment person
      const { mask, configRevision: returnedRev } = await segmentPersonAsync(this.offscreenCanvas, {
        configRevision: currentRev,
        timestamp: now,
      })

      // Ignore outdated configuration results
      if (returnedRev !== this.configRevision || this.isDisposed) {
        return
      }

      if (!mask) {
        // Segmentation returned null (e.g. offline/error), draw offscreen as passthrough
        prevCtx.drawImage(this.offscreenCanvas, 0, 0)
        return
      }

      // 4. Background composition
      const offImageData = offCtx.getImageData(0, 0, targetWidth, targetHeight)
      const composed = composeVirtualBackground(
        { width: targetWidth, height: targetHeight, data: offImageData.data },
        mask,
        this.currentSpec,
      )

      const outputImgData = prevCtx.createImageData(targetWidth, targetHeight)
      outputImgData.data.set(composed.data)
      prevCtx.putImageData(outputImgData, 0, 0)

      if (this.status !== 'ready') {
        this.setStatus('ready')
      }
    } catch {
      // On error, passthrough unsegmented frame
      prevCtx.drawImage(this.offscreenCanvas, 0, 0)
    } finally {
      this.isInferring = false
    }
  }
}
