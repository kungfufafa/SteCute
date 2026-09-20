import { useCameraStore } from '@/app/store/useCameraStore'
import { getObjectCoverCrop } from './cover-crop'

export { getObjectCoverCrop } from './cover-crop'

export type FacingMode = 'user' | 'environment'
export type CameraFacingMode = FacingMode | 'unknown'
export type CameraLensKind = 'standard' | 'ultrawide' | 'telephoto' | 'macro' | 'unknown'

export interface CameraOptions {
  facingMode?: FacingMode
  deviceId?: string
  width?: { ideal: number }
  height?: { ideal: number }
  aspectRatio?: { ideal: number }
  audio?: boolean
}

const CAMERA_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
}

// Retry microphone permission without replacing an already usable camera stream.
export function initMicrophone(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ video: false, audio: CAMERA_AUDIO_CONSTRAINTS })
}

export interface CapturedFrame {
  blob: Blob
  width: number
  height: number
}

export interface CaptureFrameOptions {
  mirrored?: boolean
  processCanvas?: (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => void
}

export interface CameraDeviceOption {
  deviceId: string
  groupId: string
  label: string
  rawLabel: string
  facingMode: CameraFacingMode
  lens: CameraLensKind
  sortOrder: number
}

const STANDARD_PHOTO_ASPECT_RATIO = 4 / 3

const DEFAULT_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: 'user',
    width: { ideal: 1440 },
    height: { ideal: 1080 },
    aspectRatio: { ideal: STANDARD_PHOTO_ASPECT_RATIO },
  },
  audio: false,
}

function normalizeLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ')
}

function normalizeFacingMode(value?: string | null): CameraFacingMode {
  if (value === 'user' || value === 'left' || value === 'right') return 'user'
  if (value === 'environment') return 'environment'
  return 'unknown'
}

function normalizeFacingModeConstraint(
  value: MediaTrackConstraints['facingMode'],
): CameraFacingMode {
  if (typeof value === 'string') return normalizeFacingMode(value)

  if (Array.isArray(value)) {
    return value.reduce<CameraFacingMode>((result, item) => {
      if (result !== 'unknown') return result
      return normalizeFacingMode(item)
    }, 'unknown')
  }

  if (value && typeof value === 'object') {
    const exact = normalizeFacingModeConstraint(value.exact)
    if (exact !== 'unknown') return exact

    return normalizeFacingModeConstraint(value.ideal)
  }

  return 'unknown'
}

export function inferCameraFacingMode(label: string): CameraFacingMode {
  const normalized = label.toLowerCase()

  if (/\b(front|user|selfie|depan|facetime)\b/.test(normalized)) return 'user'
  if (/\b(back|rear|environment|world|belakang)\b/.test(normalized)) return 'environment'

  return 'unknown'
}

export function inferCameraLens(label: string, facingMode: CameraFacingMode): CameraLensKind {
  const normalized = label.toLowerCase()

  if (/ultra[\s-]?wide|ultrawide|0[,.]5\s*x|\b\.5\s*x/.test(normalized)) return 'ultrawide'
  if (/\b(telephoto|tele|optical|zoom)\b|[23]\s*x/.test(normalized)) return 'telephoto'
  if (/\bmacro\b/.test(normalized)) return 'macro'
  if (facingMode === 'user' || facingMode === 'environment') return 'standard'

  return 'unknown'
}

export function shouldMirrorCamera(facingMode: CameraFacingMode): boolean {
  return facingMode === 'user'
}

function getCameraDisplayLabel(
  rawLabel: string,
  facingMode: CameraFacingMode,
  lens: CameraLensKind,
  index: number,
) {
  if (facingMode === 'unknown' && rawLabel) return rawLabel

  const base =
    facingMode === 'user'
      ? 'Depan'
      : facingMode === 'environment'
        ? 'Belakang'
        : `Kamera ${index + 1}`

  if (lens === 'ultrawide') return `${base} 0.5x`
  if (lens === 'telephoto') return `${base} Tele`
  if (lens === 'macro') return `${base} Macro`

  return base
}

function getCameraSortOrder(
  facingMode: CameraFacingMode,
  lens: CameraLensKind,
  index: number,
): number {
  const facingOrder = facingMode === 'user' ? 0 : facingMode === 'environment' ? 10 : 20
  const lensOrder =
    lens === 'standard'
      ? 0
      : lens === 'ultrawide'
        ? 1
        : lens === 'telephoto'
          ? 2
          : lens === 'macro'
            ? 3
            : 4

  return facingOrder + lensOrder + index / 1000
}

export function normalizeCameraDevices(
  devices: Pick<MediaDeviceInfo, 'deviceId' | 'groupId' | 'label'>[],
): CameraDeviceOption[] {
  const options = devices.map((device, index) => {
    const rawLabel = normalizeLabel(device.label)
    const facingMode = inferCameraFacingMode(rawLabel)
    const lens = inferCameraLens(rawLabel, facingMode)

    return {
      deviceId: device.deviceId,
      groupId: device.groupId,
      label: getCameraDisplayLabel(rawLabel, facingMode, lens, index),
      rawLabel,
      facingMode,
      lens,
      sortOrder: getCameraSortOrder(facingMode, lens, index),
    }
  })

  const labelCounts = new Map<string, number>()
  options.forEach((option) => {
    labelCounts.set(option.label, (labelCounts.get(option.label) ?? 0) + 1)
  })

  const seenLabels = new Map<string, number>()
  return options
    .map((option) => {
      const count = labelCounts.get(option.label) ?? 0
      if (count <= 1) return option

      const nextSeen = (seenLabels.get(option.label) ?? 0) + 1
      seenLabels.set(option.label, nextSeen)

      return {
        ...option,
        label: `${option.label} ${nextSeen}`,
      }
    })
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

export async function initCamera(options?: CameraOptions): Promise<MediaStream> {
  const cameraStore = useCameraStore()

  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      cameraStore.setPermissionState('unavailable')
      throw new DOMException('Camera API is unavailable in this browser.', 'NotFoundError')
    }

    const videoConstraints: MediaTrackConstraints = {
      ...(DEFAULT_CONSTRAINTS.video as MediaTrackConstraints),
      ...(options?.width ? { width: options.width } : {}),
      ...(options?.height ? { height: options.height } : {}),
      ...(options?.aspectRatio ? { aspectRatio: options.aspectRatio } : {}),
    }

    if (options?.deviceId) {
      delete videoConstraints.facingMode
      videoConstraints.deviceId = { exact: options.deviceId }
    } else if (options?.facingMode) {
      videoConstraints.facingMode = options.facingMode
    }

    const stream = await getCameraMediaStream(videoConstraints, options?.audio === true)
    cameraStore.setPermissionState('granted')
    cameraStore.setStreamReady(true)

    const videoTrack = stream.getVideoTracks()[0]
    if (videoTrack) {
      const settings = videoTrack.getSettings()
      const deviceId = settings.deviceId ?? null
      let label = normalizeLabel(videoTrack.label)
      let facingMode = normalizeFacingMode(settings.facingMode)

      if (deviceId && (!label || facingMode === 'unknown')) {
        try {
          const devices = await enumerateDevices()
          const activeDevice = devices.find((device) => device.deviceId === deviceId)
          if (activeDevice) {
            label = normalizeLabel(activeDevice.label)
            if (facingMode === 'unknown') facingMode = inferCameraFacingMode(label)
          }
        } catch {
          // Device labels are optional. The active stream remains usable without them.
        }
      }

      if (facingMode === 'unknown' && options?.facingMode) {
        facingMode = normalizeFacingMode(options.facingMode)
      }

      if (facingMode === 'unknown' && label) {
        facingMode = inferCameraFacingMode(label)
      }

      if (facingMode === 'unknown' && !options?.deviceId) {
        facingMode = normalizeFacingModeConstraint(videoConstraints.facingMode)
      }

      cameraStore.setActiveDevice(deviceId, facingMode, label)
    }

    return stream
  } catch (error) {
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        cameraStore.setPermissionState('denied')
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        cameraStore.setPermissionState('unavailable')
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        cameraStore.setPermissionState('unavailable')
      }
    }
    throw error
  }
}

export async function enumerateDevices(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return []

  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices.filter((d) => d.kind === 'videoinput')
}

export async function getCameraDeviceOptions(): Promise<CameraDeviceOption[]> {
  return normalizeCameraDevices(await enumerateDevices())
}

export async function switchCamera(
  deviceId: string,
  facingMode?: FacingMode,
): Promise<MediaStream> {
  return initCamera({
    deviceId,
    ...(facingMode ? { facingMode } : {}),
  })
}

export function stopCamera(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop())
  const cameraStore = useCameraStore()
  cameraStore.setStreamReady(false)
}

function getStandardPhotoCrop(width: number, height: number) {
  const sourceRatio = width / height
  let sx = 0
  let sy = 0
  let sw = width
  let sh = height

  if (sourceRatio > STANDARD_PHOTO_ASPECT_RATIO) {
    sw = Math.round(height * STANDARD_PHOTO_ASPECT_RATIO)
    sx = Math.round((width - sw) / 2)
  } else if (sourceRatio < STANDARD_PHOTO_ASPECT_RATIO) {
    sh = Math.round(width / STANDARD_PHOTO_ASPECT_RATIO)
    sy = Math.round((height - sh) / 2)
  }

  return { sx, sy, sw, sh }
}

export function captureFrame(
  videoEl: HTMLVideoElement,
  options: CaptureFrameOptions = {},
): Promise<CapturedFrame> {
  return new Promise((resolve, reject) => {
    if (videoEl.videoWidth === 0 || videoEl.videoHeight === 0) {
      reject(new Error('Camera preview is not ready yet'))
      return
    }

    const crop = getStandardPhotoCrop(videoEl.videoWidth, videoEl.videoHeight)
    const canvas = document.createElement('canvas')
    canvas.width = crop.sw
    canvas.height = crop.sh
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      reject(new Error('Failed to get canvas context'))
      return
    }
    if (options.mirrored) {
      ctx.translate(crop.sw, 0)
      ctx.scale(-1, 1)
    }

    ctx.drawImage(videoEl, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, crop.sw, crop.sh)
    applyCaptureProcess(canvas, ctx, options)
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve({
            blob,
            width: crop.sw,
            height: crop.sh,
          })
        } else {
          reject(new Error('Failed to capture frame'))
        }
      },
      'image/jpeg',
      0.92,
    )
  })
}

export function captureCoverFrame(
  videoEl: HTMLVideoElement,
  dest: { width: number; height: number },
  options: CaptureFrameOptions = {},
): Promise<CapturedFrame> {
  return new Promise((resolve, reject) => {
    if (videoEl.videoWidth === 0 || videoEl.videoHeight === 0) {
      reject(new Error('Camera preview is not ready yet'))
      return
    }

    const width = Math.max(1, Math.floor(dest.width))
    const height = Math.max(1, Math.floor(dest.height))
    const crop = getObjectCoverCrop(videoEl.videoWidth, videoEl.videoHeight, width, height)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      reject(new Error('Failed to get canvas context'))
      return
    }
    if (options.mirrored) {
      ctx.translate(width, 0)
      ctx.scale(-1, 1)
    }

    ctx.drawImage(videoEl, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, width, height)
    applyCaptureProcess(canvas, ctx, options)
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve({ blob, width, height })
        } else {
          reject(new Error('Failed to capture frame'))
        }
      },
      'image/jpeg',
      0.92,
    )
  })
}

async function getCameraMediaStream(
  videoConstraints: MediaTrackConstraints,
  withAudio: boolean,
): Promise<MediaStream> {
  const constraints: MediaStreamConstraints = {
    video: videoConstraints,
    audio: withAudio ? CAMERA_AUDIO_CONSTRAINTS : false,
  }

  try {
    return await navigator.mediaDevices.getUserMedia(constraints)
  } catch (error) {
    if (!withAudio) throw error

    return await navigator.mediaDevices.getUserMedia({
      video: videoConstraints,
      audio: false,
    })
  }
}

function applyCaptureProcess(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  options: CaptureFrameOptions,
) {
  if (!options.processCanvas) return
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  options.processCanvas(canvas, ctx)
}
