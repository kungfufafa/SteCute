export {
  CUSTOM_BACKGROUND_MAX_BYTES,
  VIRTUAL_BACKGROUNDS,
  getVirtualBackgroundById,
  isVirtualBackgroundActive,
  normalizeVirtualBackgroundId,
  parseBackgroundColor,
  validateCustomBackgroundFile,
} from './catalog'
export { composeVirtualBackground, type PersonMask, type RgbaFrame } from './compose'
export {
  clearCustomVirtualBackgroundFrame,
  loadCustomVirtualBackgroundFrame,
  normalizeHostCustomBackground,
  resolveVirtualBackgroundSpec,
  setCustomVirtualBackgroundFrame,
} from './custom-image'
export {
  PERSON_SEGMENTER_MODEL_PATH,
  PERSON_SEGMENTER_WASM_BASE_PATH,
  applyVirtualBackgroundOrPassthrough,
  applyVirtualBackgroundToCanvas,
  destroyPersonSegmenter,
  initPersonSegmenter,
  isPersonSegmenterReady,
  segmentPerson,
  segmentPersonAsync,
} from './segment'
export {
  CameraBackgroundProcessor,
  configureActiveBackgroundStatus,
  shouldNotifyBackgroundStatus,
  type BackgroundProcessorStatus,
  type CameraBackgroundProcessorLike,
} from './processor'
