import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision'
import {
  PERSON_SEGMENTER_MODEL_PATH,
  PERSON_SEGMENTER_WASM_BASE_PATH,
  applyVirtualBackgroundOrPassthrough,
  destroyPersonSegmenter,
  initPersonSegmenter,
  isPersonSegmenterReady,
  segmentPerson,
  segmentPersonAsync,
} from '@/services/virtual-background'

const mockedMediapipe = vi.hoisted(() => ({
  wasmFileset: {
    wasmLoaderPath: '/vendor/mediapipe/tasks-vision/wasm/vision_wasm_internal.js',
    wasmBinaryPath: '/vendor/mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm',
  },
  segmenter: {
    close: vi.fn(),
    segmentForVideo: vi.fn(() => ({
      categoryMask: {
        width: 2,
        height: 2,
        getAsUint8Array: () => new Uint8Array([1, 0, 1, 0]),
        close: vi.fn(),
      },
    })),
  },
}))

vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: {
    forVisionTasks: vi.fn(async () => mockedMediapipe.wasmFileset),
  },
  ImageSegmenter: {
    createFromOptions: vi.fn(async () => mockedMediapipe.segmenter),
  },
}))

describe('person segmenter MediaPipe assets', () => {
  beforeEach(() => {
    destroyPersonSegmenter()
    vi.clearAllMocks()
  })

  afterEach(() => {
    destroyPersonSegmenter()
  })

  it('keeps the bundled selfie segmenter files on disk', () => {
    const vendorRoot = fileURLToPath(
      new URL('../../../../public/vendor/mediapipe', import.meta.url),
    )
    expect(
      existsSync(
        `${vendorRoot}/models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite`,
      ),
    ).toBe(true)
    expect(existsSync(`${vendorRoot}/tasks-vision/wasm/vision_wasm_internal.js`)).toBe(true)
    expect(existsSync(`${vendorRoot}/tasks-vision/wasm/vision_wasm_internal.wasm`)).toBe(true)
    expect(existsSync(`${vendorRoot}/manifest.json`)).toBe(true)
  })

  it('uses bundled local MediaPipe assets instead of remote CDN URLs', () => {
    expect(PERSON_SEGMENTER_WASM_BASE_PATH).toBe('/vendor/mediapipe/tasks-vision/wasm')
    expect(PERSON_SEGMENTER_MODEL_PATH).toBe(
      '/vendor/mediapipe/models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite',
    )
    expect(PERSON_SEGMENTER_WASM_BASE_PATH).not.toMatch(/^https?:\/\//)
    expect(PERSON_SEGMENTER_MODEL_PATH).not.toMatch(/^https?:\/\//)
    expect(PERSON_SEGMENTER_WASM_BASE_PATH).not.toContain('cdn.jsdelivr.net')
    expect(PERSON_SEGMENTER_MODEL_PATH).not.toContain('storage.googleapis.com')
  })

  it('initializes the segmenter from bundled assets', async () => {
    await expect(initPersonSegmenter()).resolves.toBe(true)

    expect(FilesetResolver.forVisionTasks).toHaveBeenCalledWith(
      '/vendor/mediapipe/tasks-vision/wasm',
    )
    expect(ImageSegmenter.createFromOptions).toHaveBeenCalledWith(
      mockedMediapipe.wasmFileset,
      expect.objectContaining({
        baseOptions: expect.objectContaining({
          modelAssetPath:
            '/vendor/mediapipe/models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite',
          delegate: 'GPU',
        }),
      }),
    )
  })

  it('falls back to CPU when GPU initialization fails', async () => {
    vi.mocked(ImageSegmenter.createFromOptions)
      .mockRejectedValueOnce(new Error('GPU unavailable'))
      .mockResolvedValueOnce(mockedMediapipe.segmenter)

    await expect(initPersonSegmenter()).resolves.toBe(true)
    expect(
      vi.mocked(ImageSegmenter.createFromOptions).mock.calls[0]?.[1].baseOptions?.delegate,
    ).toBe('GPU')
    expect(
      vi.mocked(ImageSegmenter.createFromOptions).mock.calls[1]?.[1].baseOptions?.delegate,
    ).toBe('CPU')
  })

  it('returns the original frame when the segmenter is unavailable or fails', async () => {
    const source = {
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 255]),
    }

    expect(isPersonSegmenterReady()).toBe(false)
    expect(segmentPerson({ videoWidth: 8, videoHeight: 8 } as HTMLVideoElement)).toBeNull()
    expect(applyVirtualBackgroundOrPassthrough(source, null, { id: 'pink' })).toBe(source)

    vi.mocked(FilesetResolver.forVisionTasks).mockRejectedValueOnce(new Error('offline'))
    await expect(initPersonSegmenter()).resolves.toBe(false)
    expect(isPersonSegmenterReady()).toBe(false)
    expect(
      applyVirtualBackgroundOrPassthrough(source, segmentPerson({} as HTMLVideoElement), {
        id: 'blue',
      }),
    ).toBe(source)
  })

  it('falls back to the main-thread segmenter when the worker returns no mask', async () => {
    const listeners: Array<(event: MessageEvent) => void> = []

    class FakeWorker {
      onmessage: ((event: MessageEvent) => void) | null = null

      addEventListener(type: string, listener: (event: MessageEvent) => void) {
        if (type === 'message') listeners.push(listener)
      }

      removeEventListener(type: string, listener: (event: MessageEvent) => void) {
        const index = listeners.indexOf(listener)
        if (index >= 0) listeners.splice(index, 1)
      }

      postMessage(message: { type: string; frameId?: number; configRevision?: number }) {
        queueMicrotask(() => {
          if (message.type === 'init') {
            const event = { data: { type: 'init-result', success: true } } as MessageEvent
            for (const listener of listeners) listener(event)
            return
          }

          if (message.type === 'segment') {
            this.onmessage?.({
              data: {
                type: 'segment-result',
                frameId: message.frameId,
                configRevision: message.configRevision ?? 0,
                success: false,
              },
            } as MessageEvent)
          }
        })
      }

      terminate() {}
    }

    vi.stubGlobal('Worker', FakeWorker)
    vi.stubGlobal(
      'createImageBitmap',
      async () =>
        ({
          close() {},
        }) as ImageBitmap,
    )

    try {
      await expect(initPersonSegmenter()).resolves.toBe(true)
      const result = await segmentPersonAsync({ width: 8, height: 8 } as HTMLCanvasElement, {
        configRevision: 3,
      })
      expect(result.mask).not.toBeNull()
      expect(result.configRevision).toBe(3)
      expect(ImageSegmenter.createFromOptions).toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
