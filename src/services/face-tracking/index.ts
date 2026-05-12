import { FilesetResolver, FaceDetector } from '@mediapipe/tasks-vision'

export interface FaceBounds {
  /** Normalized x (0–1), left edge of bounding box */
  x: number
  /** Normalized y (0–1), top edge of bounding box */
  y: number
  /** Normalized width (0–1) */
  width: number
  /** Normalized height (0–1) */
  height: number
}

export interface FaceTrackingResult {
  faces: FaceBounds[]
  timestamp: number
}

let faceDetector: FaceDetector | null = null
let initPromise: Promise<FaceDetector> | null = null
let lastDetectionTimestamp = -1

const MEDIAPIPE_ASSET_BASE_PATH = `${import.meta.env.BASE_URL}vendor/mediapipe`

export const FACE_DETECTOR_WASM_BASE_PATH = `${MEDIAPIPE_ASSET_BASE_PATH}/tasks-vision/wasm`
export const FACE_DETECTOR_MODEL_PATH = `${MEDIAPIPE_ASSET_BASE_PATH}/models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite`

type FaceDetectorDelegate = 'GPU' | 'CPU'
type VisionWasmFileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>

function isValidDetectedFace(face: FaceBounds): boolean {
  return (
    Number.isFinite(face.x) &&
    Number.isFinite(face.y) &&
    Number.isFinite(face.width) &&
    Number.isFinite(face.height) &&
    face.width > 0 &&
    face.height > 0
  )
}

/**
 * Initialize the MediaPipe Face Detector singleton.
 * Safe to call multiple times — subsequent calls return the existing instance.
 */
export async function initFaceDetector(): Promise<FaceDetector> {
  if (faceDetector) return faceDetector
  if (initPromise) return initPromise

  initPromise = (async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(FACE_DETECTOR_WASM_BASE_PATH)

      try {
        faceDetector = await createFaceDetector(vision, 'GPU')
      } catch {
        faceDetector = await createFaceDetector(vision, 'CPU')
      }

      return faceDetector
    } catch (error) {
      initPromise = null
      throw error
    }
  })()

  return initPromise
}

function createFaceDetector(
  vision: VisionWasmFileset,
  delegate: FaceDetectorDelegate,
): Promise<FaceDetector> {
  return FaceDetector.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: FACE_DETECTOR_MODEL_PATH,
      delegate,
    },
    runningMode: 'VIDEO',
    minDetectionConfidence: 0.5,
  })
}

/**
 * Detect faces in the current video frame.
 * Returns normalized bounding boxes for all detected faces.
 *
 * The video element must have valid dimensions (videoWidth > 0).
 * Timestamps must be monotonically increasing.
 */
export function detectFaces(videoEl: HTMLVideoElement): FaceTrackingResult {
  if (!faceDetector) {
    return { faces: [], timestamp: 0 }
  }

  if (videoEl.videoWidth === 0 || videoEl.videoHeight === 0) {
    return { faces: [], timestamp: 0 }
  }

  // Ensure monotonically increasing timestamps for VIDEO mode
  const now = performance.now()
  const timestamp = now <= lastDetectionTimestamp ? lastDetectionTimestamp + 1 : now
  lastDetectionTimestamp = timestamp

  try {
    const result = faceDetector.detectForVideo(videoEl, timestamp)

    const faces: FaceBounds[] = (result.detections ?? []).flatMap((detection) => {
      const bbox = detection.boundingBox
      if (!bbox) {
        return []
      }

      const face = {
        x: bbox.originX / videoEl.videoWidth,
        y: bbox.originY / videoEl.videoHeight,
        width: bbox.width / videoEl.videoWidth,
        height: bbox.height / videoEl.videoHeight,
      }

      return isValidDetectedFace(face) ? [face] : []
    })

    return { faces, timestamp }
  } catch {
    return { faces: [], timestamp }
  }
}

/**
 * Clean up the face detector and free resources.
 */
export function destroyFaceDetector(): void {
  if (faceDetector) {
    faceDetector.close()
    faceDetector = null
  }
  initPromise = null
  lastDetectionTimestamp = -1
}

/**
 * Check if the face detector is ready to use.
 */
export function isFaceDetectorReady(): boolean {
  return faceDetector !== null
}
