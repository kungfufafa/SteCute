export {
  CUSTOM_BACKGROUND_MAX_BYTES,
  VIRTUAL_BACKGROUNDS,
  getVirtualBackgroundById,
  isVirtualBackgroundActive,
  normalizeVirtualBackgroundId,
  parseBackgroundColor,
  validateCustomBackgroundFile,
  type CustomBackgroundValidation,
  type VirtualBackgroundConfig,
  type VirtualBackgroundMode,
} from './catalog'
export {
  composeVirtualBackground,
  type ComposeVirtualBackgroundOptions,
  type PersonMask,
  type RgbaFrame,
  type VirtualBackgroundSpec,
} from './compose'
export {
  clearCustomVirtualBackgroundFrame,
  getCustomVirtualBackgroundFrame,
  loadCustomVirtualBackgroundFrame,
  normalizeHostCustomBackground,
  calculateBlobSha256,
  resolveVirtualBackgroundSpec,
  setCustomVirtualBackgroundFrame,
  type NormalizedCustomBackground,
  MAX_HOST_BACKGROUND_DIMENSION,
  MAX_HOST_BACKGROUND_BYTES,
} from './custom-image'
export {
  PERSON_SEGMENTER_MODEL_PATH,
  PERSON_SEGMENTER_WASM_BASE_PATH,
  WORKER_MAX_PREVIEW_SIDE,
  WORKER_MIN_FRAME_INTERVAL_MS,
  MAIN_THREAD_MAX_PREVIEW_SIDE,
  MAIN_THREAD_MIN_FRAME_INTERVAL_MS,
  applyVirtualBackgroundOrPassthrough,
  applyVirtualBackgroundToCanvas,
  destroyPersonSegmenter,
  ensurePersonSegmenter,
  ensureWorkerSegmenter,
  initPersonSegmenter,
  isPersonSegmenterReady,
  releasePersonSegmenter,
  retainPersonSegmenter,
  segmentPerson,
  segmentPersonAsync,
} from './segment'
export {
  CameraBackgroundProcessor,
  type BackgroundProcessorStatus,
  type CameraBackgroundProcessorLike,
  type CameraBackgroundProcessorOptions,
} from './processor'

