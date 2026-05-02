import { useCameraStore } from '@/stores'

export type FacingMode = 'user' | 'environment'

export interface CameraOptions {
  facingMode?: FacingMode
  deviceId?: string
  width?: { ideal: number }
  height?: { ideal: number }
}

const DEFAULT_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: 'user',
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
  audio: false,
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
    }

    const constraints: MediaStreamConstraints = {
      video: videoConstraints,
      audio: false,
    }

    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    cameraStore.setPermissionState('granted')
    cameraStore.setStreamReady(true)

    const devices = await enumerateDevices()
    cameraStore.setAvailableDevices(devices)

    const videoTrack = stream.getVideoTracks()[0]
    if (videoTrack) {
      cameraStore.setActiveDevice(videoTrack.getSettings().deviceId ?? null)
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

export async function switchCamera(deviceId: string): Promise<MediaStream> {
  return initCamera({ deviceId })
}

export function stopCamera(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop())
  const cameraStore = useCameraStore()
  cameraStore.setStreamReady(false)
}

export function captureFrame(videoEl: HTMLVideoElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (videoEl.videoWidth === 0 || videoEl.videoHeight === 0) {
      reject(new Error('Camera preview is not ready yet'))
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = videoEl.videoWidth
    canvas.height = videoEl.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      reject(new Error('Failed to get canvas context'))
      return
    }
    ctx.drawImage(videoEl, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Failed to capture frame'))
        }
      },
      'image/png',
      1.0,
    )
  })
}
