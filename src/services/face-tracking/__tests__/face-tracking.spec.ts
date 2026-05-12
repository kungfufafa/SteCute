import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision'
import {
  destroyFaceDetector,
  FACE_DETECTOR_MODEL_PATH,
  FACE_DETECTOR_WASM_BASE_PATH,
  initFaceDetector,
} from '@/services/face-tracking'

const mockedMediapipe = vi.hoisted(() => ({
  wasmFileset: {
    wasmLoaderPath: '/vendor/mediapipe/tasks-vision/wasm/vision_wasm_internal.js',
    wasmBinaryPath: '/vendor/mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm',
  },
  detector: {
    close: vi.fn(),
  },
}))

vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: {
    forVisionTasks: vi.fn(async () => mockedMediapipe.wasmFileset),
  },
  FaceDetector: {
    createFromOptions: vi.fn(async () => mockedMediapipe.detector),
  },
}))

describe('face tracking MediaPipe assets', () => {
  beforeEach(() => {
    destroyFaceDetector()
    vi.clearAllMocks()
  })

  afterEach(() => {
    destroyFaceDetector()
  })

  it('uses bundled local MediaPipe assets instead of remote CDN URLs', () => {
    expect(FACE_DETECTOR_WASM_BASE_PATH).toBe('/vendor/mediapipe/tasks-vision/wasm')
    expect(FACE_DETECTOR_MODEL_PATH).toBe(
      '/vendor/mediapipe/models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
    )
    expect(FACE_DETECTOR_WASM_BASE_PATH).not.toMatch(/^https?:\/\//)
    expect(FACE_DETECTOR_MODEL_PATH).not.toMatch(/^https?:\/\//)
  })

  it('initializes the detector from bundled assets', async () => {
    await initFaceDetector()

    expect(FilesetResolver.forVisionTasks).toHaveBeenCalledWith(
      '/vendor/mediapipe/tasks-vision/wasm',
    )
    expect(FaceDetector.createFromOptions).toHaveBeenCalledWith(
      mockedMediapipe.wasmFileset,
      expect.objectContaining({
        baseOptions: expect.objectContaining({
          modelAssetPath:
            '/vendor/mediapipe/models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
          delegate: 'GPU',
        }),
      }),
    )
  })

  it('falls back to CPU when GPU initialization fails', async () => {
    vi.mocked(FaceDetector.createFromOptions)
      .mockRejectedValueOnce(new Error('GPU unavailable'))
      .mockResolvedValueOnce(mockedMediapipe.detector)

    await initFaceDetector()

    expect(vi.mocked(FaceDetector.createFromOptions).mock.calls).toHaveLength(2)
    expect(vi.mocked(FaceDetector.createFromOptions).mock.calls[0]?.[1].baseOptions?.delegate).toBe(
      'GPU',
    )
    expect(vi.mocked(FaceDetector.createFromOptions).mock.calls[1]?.[1].baseOptions?.delegate).toBe(
      'CPU',
    )
  })
})
