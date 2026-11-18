export { createBoothRoomTransport } from './room'
export { canBeginBoothCapture, type BoothCapturePhase } from './capture-state'
export {
  BOOTH_TTL_MS,
  buildInviteUrl,
  createBooth,
  createLocalStorageRegistry,
  createMemoryRegistry,
  getBoothRegistry,
  joinBoothByCode,
  joinBoothByInvite,
  normalizeBoothCode,
  persistBoothHostRole,
  type BoothIdentity,
  type BoothJoinError,
} from './identity'
export { composePairRow, type BoothStill, type ComposedPairShot } from './compose'
export {
  createBoothPeerSession,
  createPeerId,
  type BoothPeerRole,
  type BoothPeerSession,
} from './session'
export {
  boothHostPeerBackgroundLabel,
  boothHostStartLabel,
  isBoothCaptureBackgroundReady,
  shouldConfirmGuestBackgroundReady,
} from './background-ready'
export { BOOTH_AUTO_CAPTURE_GAP_MS, nextBoothAutoCaptureAction } from './auto-capture'
export {
  BOOTH_COUNTDOWN_SECONDS,
  DEFAULT_BOOTH_COUNTDOWN_SECONDS,
  DEFAULT_BOOTH_LAYOUT_ID,
  DEFAULT_BOOTH_TEMPLATE_ID,
  bundledBoothLayouts,
  bundledBoothTemplates,
  boothSetupsEqual,
  createDefaultBoothSetup,
  normalizeBoothSetup,
  pairSlotForLayout,
  type BoothSessionSetup,
} from './setup'
export { composeBoothMediaStream, isRemotePreviewReady } from './preview'
export {
  createInProcessTransportPair,
  type BoothTransport,
  type BoothWireMessage,
} from './transport'
