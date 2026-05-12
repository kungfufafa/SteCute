import { useCameraStore } from '@/app/store/useCameraStore'

export type FacingMode = 'user' | 'environment'
export type CameraFacingMode = FacingMode | 'unknown'
export type CameraLensKind = 'standard' | 'ultrawide' | 'telephoto' | 'macro' | 'unknown'

export interface CameraOptions {
  facingMode?: FacingMode
  deviceId?: string
  width?: { ideal: number }
  height?: { ideal: number }
  aspectRatio?: { ideal: number }
}

export interface CapturedFrame {
  blob: Blob
  width: number
  height: number
}

export interface CaptureFrameOptions {
  mirrored?: boolean
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
      ...(options?.deviceId ? { deviceId: { exact: options.deviceId } } : {}),
      ...(options?.facingMode ? { facingMode: options.facingMode } : {}),
      ...(options?.width ? { width: options.width } : {}),
      ...(options?.height ? { height: options.height } : {}),
      ...(options?.aspectRatio ? { aspectRatio: options.aspectRatio } : {}),
    }

    const constraints: MediaStreamConstraints = {
      video: videoConstraints,
      audio: false,
    }

    const stream = await navigator.mediaDevices.getUserMedia(constraints)
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

export async function switchCamera(deviceId: string): Promise<MediaStream> {
  return initCamera({ deviceId })
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
      'image/png',
      1.0,
    )
  })
}
