import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision'

export type SegmentWorkerInMessage =
  | {
      type: 'init'
      wasmBasePath: string
      modelPath: string
    }
  | {
      type: 'segment'
      frameId: number
      configRevision: number
      bitmap: ImageBitmap
      timestamp: number
    }
  | {
      type: 'close'
    }

export type SegmentWorkerOutMessage =
  | {
      type: 'init-result'
      success: boolean
      error?: string
    }
  | {
      type: 'segment-result'
      frameId: number
      configRevision: number
      success: boolean
      mask?: {
        width: number
        height: number
        data: Uint8Array
      }
      error?: string
    }

let segmenter: ImageSegmenter | null = null
let lastTimestamp = -1

self.onmessage = async (event: MessageEvent<SegmentWorkerInMessage>) => {
  const message = event.data
  if (!message || typeof message !== 'object') return

  if (message.type === 'init') {
    try {
      if (segmenter) {
        segmenter.close()
        segmenter = null
      }

      const vision = await FilesetResolver.forVisionTasks(message.wasmBasePath)
      try {
        segmenter = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: message.modelPath,
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          outputCategoryMask: false,
          outputConfidenceMasks: true,
        })
      } catch {
        segmenter = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: message.modelPath,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          outputCategoryMask: false,
          outputConfidenceMasks: true,
        })
      }

      const response: SegmentWorkerOutMessage = { type: 'init-result', success: true }
      self.postMessage(response)
    } catch (error) {
      const response: SegmentWorkerOutMessage = {
        type: 'init-result',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
      self.postMessage(response)
    }
    return
  }

  if (message.type === 'segment') {
    const { frameId, configRevision, bitmap, timestamp } = message
    if (!segmenter) {
      bitmap.close?.()
      const response: SegmentWorkerOutMessage = {
        type: 'segment-result',
        frameId,
        configRevision,
        success: false,
        error: 'Segmenter not initialized',
      }
      self.postMessage(response)
      return
    }

    try {
      const safeTimestamp = timestamp <= lastTimestamp ? lastTimestamp + 1 : timestamp
      lastTimestamp = safeTimestamp

      const result = segmenter.segmentForVideo(bitmap, safeTimestamp)
      bitmap.close?.()

      const personConfidence = result.confidenceMasks?.[1] ?? result.confidenceMasks?.[0]
      if (personConfidence) {
        const floats = personConfidence.getAsFloat32Array()
        const data = new Uint8Array(floats.length)
        for (let i = 0; i < floats.length; i++) {
          data[i] = Math.round(Math.min(1, Math.max(0, floats[i])) * 255)
        }
        const width = personConfidence.width
        const height = personConfidence.height

        result.confidenceMasks?.forEach((m) => m.close?.())
        result.categoryMask?.close?.()

        const response: SegmentWorkerOutMessage = {
          type: 'segment-result',
          frameId,
          configRevision,
          success: true,
          mask: { width, height, data },
        }
        self.postMessage(response, [data.buffer])
        return
      }

      if (result.categoryMask) {
        const cat = result.categoryMask
        const raw = cat.getAsUint8Array()
        const data = new Uint8Array(raw.length)
        for (let i = 0; i < raw.length; i++) {
          data[i] = raw[i] > 0 ? 255 : 0
        }
        const width = cat.width
        const height = cat.height
        cat.close?.()

        const response: SegmentWorkerOutMessage = {
          type: 'segment-result',
          frameId,
          configRevision,
          success: true,
          mask: { width, height, data },
        }
        self.postMessage(response, [data.buffer])
        return
      }

      const response: SegmentWorkerOutMessage = {
        type: 'segment-result',
        frameId,
        configRevision,
        success: false,
        error: 'No mask found in result',
      }
      self.postMessage(response)
    } catch (error) {
      bitmap.close?.()
      const response: SegmentWorkerOutMessage = {
        type: 'segment-result',
        frameId,
        configRevision,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
      self.postMessage(response)
    }
    return
  }

  if (message.type === 'close') {
    if (segmenter) {
      segmenter.close()
      segmenter = null
    }
    lastTimestamp = -1
  }
}
