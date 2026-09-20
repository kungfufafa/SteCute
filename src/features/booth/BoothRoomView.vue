<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch, type WatchStopHandle } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Shot } from '@/db/schema'
import { getLayoutById } from '@/layouts'
import { getTemplateById } from '@/templates'
import { useCameraStore } from '@/app/store/useCameraStore'
import { captureCoverFrame, initCamera, shouldMirrorCamera, stopCamera } from '@/services/camera'
import {
  isLiveStripRenderingSupported,
  startPairLiveCamRecording,
  type LiveCamClip,
  type LiveCamRecording,
} from '@/services/live-cam'
import { getCameraEffectById, isFaceTrackingEffect } from '@/services/camera-effects'
import type { FaceBounds } from '@/services/face-tracking'
import { getPhotoFilterCss } from '@/services/filter'
import {
  CameraBackgroundProcessor,
  applyVirtualBackgroundToCanvas,
  loadCustomVirtualBackgroundFrame,
  normalizeHostCustomBackground,
  resolveVirtualBackgroundSpec,
  validateCustomBackgroundFile,
  type BackgroundProcessorStatus,
  type RgbaFrame,
} from '@/services/virtual-background'
import {
  detectOutputCapabilities,
  downloadBlob,
  generateFilename,
  getExtensionForMimeType,
  printBlob,
  saveBlob,
  shareBlob,
} from '@/services/output'
import {
  createDefaultDecorationConfig,
  isSessionComplete,
  renderSessionForOutput,
} from '@/services/session'
import {
  boothSetupsEqual,
  canBeginBoothCapture,
  buildInviteUrl,
  createBoothPeerSession,
  createBoothRoomTransport,
  createDefaultBoothSetup,
  boothHostPeerBackgroundLabel,
  boothHostStartLabel,
  BOOTH_AUTO_CAPTURE_GAP_MS,
  composeBoothMediaStream,
  createPeerId,
  isBoothCaptureBackgroundReady,
  joinBoothByCode,
  isRemotePreviewReady,
  joinBoothByInvite,
  nextBoothAutoCaptureAction,
  normalizeBoothCode,
  normalizeBoothSetup,
  pairSlotForLayout,
  shouldConfirmGuestBackgroundReady,
  type BoothIdentity,
  type BoothCapturePhase,
  type BoothJoinError,
  type BoothPeerRole,
  type BoothPeerSession,
  type BoothSessionSetup,
  type BoothTransport,
  type ComposedPairShot,
} from '@/services/booth'
import { readPendingBoothSetup, writePendingBoothSetup } from '@/services/session/persist'
import { ui } from '@/ui/styles'
import CameraEffectCanvas from '@/components/common/CameraEffectCanvas.vue'
import FaceTrackingOverlay from '@/components/common/FaceTrackingOverlay.vue'
import StripCanvasPreview from '@/components/common/StripCanvasPreview.vue'
import VirtualBackgroundCanvas from '@/components/common/VirtualBackgroundCanvas.vue'
import BoothDecorationPicker from './BoothDecorationPicker.vue'
import BoothAudioControls from './BoothAudioControls.vue'
import CaptureWorkspace from '@/components/common/CaptureWorkspace.vue'
import CaptureSessionSettings from '@/components/common/CaptureSessionSettings.vue'
import type { CaptureSessionConfig } from '@/services/session/capture-config'
import { useBoothMicrophone } from './useBoothMicrophone'

type BoothStage = 'live' | 'review' | 'output'

const ROLE_KEY = 'stecute.booth.role'
const PEER_KEY = 'stecute.booth.peer'
const CONNECTION_WAIT_MS = 20_000

const route = useRoute()
const router = useRouter()
const cameraStore = useCameraStore()
const capabilities = detectOutputCapabilities()

const identity = ref<BoothIdentity | null>(null)
const joinError = ref<BoothJoinError | 'full' | null>(null)
const role = ref<BoothPeerRole>('guest')
const inviteUrl = ref('')
const participantCount = ref(1)
const cameraError = ref('')
const statusMessage = ref('Menghubungkan ke host…')
const countdownValue = ref<number | null>(null)
const currentMoment = ref(0)
const composedShots = ref<Array<ComposedPairShot | undefined>>([])
const renderUrl = ref('')
const rendering = ref(false)
const savedToGallery = ref(false)
const connectionHelp = ref(false)
const copyNotice = ref('')
const cameraLive = ref(false)
const localVideoReady = ref(false)
const remoteCameraReady = ref(false)
const capturePhase = ref<BoothCapturePhase>('idle')
const videoRef = ref<HTMLVideoElement | null>(null)
const remoteVideoRef = ref<HTMLVideoElement | null>(null)
const remoteStream = ref<MediaStream | null>(null)
const remoteVideoReady = ref(false)
const speakerMuted = ref(false)
const remoteAudioBlocked = ref(false)
const remotePlaybackMuted = computed(() => speakerMuted.value || remoteAudioBlocked.value)
const boothSetup = ref<BoothSessionSetup>(createDefaultBoothSetup())
const stage = ref<BoothStage>('live')
const outputBusy = ref(false)
const outputNotice = ref('')
const outputError = ref('')
const showMoreActions = ref(false)
const latestOverlayFaces = ref<FaceBounds[]>([])
const latestOverlayFrameMs = ref(0)
const customBackgroundFrame = ref<RgbaFrame | null>(null)
const localBackgroundPreviewActive = ref(false)
const liveCamAvailable = ref(false)
const liveCamRecordingActive = ref(false)
const livePreviewUrl = ref('')
const renderError = ref('')
const sessionConfigOpen = ref(false)
const sessionConfigBusy = ref(false)
const sessionConfigError = ref('')

const backgroundProcessor = ref<CameraBackgroundProcessor | null>(null)
const localBackgroundStatus = ref<BackgroundProcessorStatus>('off')
const backgroundError = ref<string | null>(null)
const showBackgroundErrorModal = ref(false)
const guestBackgroundStatus = ref<'off' | 'loading' | 'ready' | 'error'>('off')
const peerBgStatus = ref<{
  peerId: string
  revision: number
  status: 'loading' | 'ready' | 'error'
  assetId?: string
  errorReason?: string
} | null>(null)
let activeBackgroundBlob: Blob | null = null

let stream: MediaStream | null = null
let peerSession: BoothPeerSession | null = null
let activeLiveCamRecording: LiveCamRecording | null = null
let roomTransport: BoothTransport | null = null
let remotePlaybackGeneration = 0
const {
  enabled: microphoneEnabled,
  available: microphoneAvailable,
  busy: microphoneBusy,
  notice: microphoneNotice,
  bindStream: bindMicrophoneStream,
  toggle: toggleMicrophone,
  dispose: disposeMicrophone,
} = useBoothMicrophone({
  setOutboundEnabled: (enabled) => roomTransport?.media?.setMicrophoneEnabled?.(enabled),
  onStreamChanged: () => updateTransportStream(),
})
let unsubRemoteStream: (() => void) | null = null
let countdownTimer: ReturnType<typeof setInterval> | null = null
let presenceTimer: ReturnType<typeof setInterval> | null = null
let captureLoop: Promise<void> | null = null
let setupLoop: Promise<void> | null = null
let resetLoop: Promise<void> | null = null
let countdownResolve: (() => void) | null = null
let waitStartedAt = Date.now()
let copyNoticeTimer: number | null = null
let remoteReadyTimer: ReturnType<typeof setInterval> | null = null
let outputBlob: Blob | null = null
let autoCaptureTimeout: ReturnType<typeof setTimeout> | null = null
let autoCaptureRunning = false
let stopAutoStartWatch: WatchStopHandle | null = null
let disposed = false
let cameraGeneration = 0
let connectionGeneration = 0
let connectionAbort: AbortController | null = null
let activeCaptureId: string | null = null
let reviewRevision = 0

const formattedCode = computed(() => identity.value?.code ?? '')
const slotCount = computed(() => boothSetup.value.slotCount)
const capturedCount = computed(() => composedShots.value.filter(Boolean).length)
const shotsComplete = computed(() =>
  isSessionComplete(
    composedShots.value.flatMap((shot, order) => (shot ? [{ order }] : [])),
    slotCount.value,
  ),
)
const friendJoined = computed(() => participantCount.value >= 2)
const cameraReady = computed(() => cameraLive.value && localVideoReady.value && !cameraError.value)
const canManageSessionConfig = computed(
  () =>
    role.value === 'host' &&
    stage.value === 'live' &&
    capturePhase.value === 'idle' &&
    !rendering.value &&
    !sessionConfigBusy.value,
)
const canEditSessionConfig = computed(
  () => canManageSessionConfig.value && capturedCount.value === 0,
)
const sessionConfig = computed<CaptureSessionConfig>(() => ({
  layoutId: boothSetup.value.layoutId,
  templateId: boothSetup.value.templateId,
  slotCount: boothSetup.value.slotCount,
  countdownSeconds: Math.round(boothSetup.value.countdownMs / 1000),
  autoCapture: boothSetup.value.autoCapture,
}))
const canChangeSetup = computed(() => canEditSessionConfig.value && !sessionConfigOpen.value)

const isBackgroundReady = computed(() =>
  isBoothCaptureBackgroundReady({
    backgroundId: boothSetup.value.virtualBackgroundId,
    localStatus: localBackgroundStatus.value,
    friendJoined: friendJoined.value,
    role: role.value,
    peerStatus: peerBgStatus.value,
    setupRevision: boothSetup.value.revision ?? 1,
    guestStatus: guestBackgroundStatus.value,
  }),
)
const hostStartLabel = computed(() => {
  if (capturePhase.value === 'exchanging') return 'Menyiapkan foto bersama…'
  if (!cameraReady.value) return 'Menyiapkan kameramu…'
  if (friendJoined.value && !remoteCameraReady.value) return 'Menunggu kamera teman…'
  return boothHostStartLabel({
    friendJoined: friendJoined.value,
    captureReady: isBackgroundReady.value,
    localReady:
      boothSetup.value.virtualBackgroundId === 'off' || localBackgroundStatus.value === 'ready',
  })
})
const hostPeerBackgroundLabel = computed(() =>
  boothHostPeerBackgroundLabel(peerBgStatus.value?.status),
)

const canStart = computed(
  () =>
    !sessionConfigOpen.value &&
    !sessionConfigBusy.value &&
    canBeginBoothCapture({
      role: role.value,
      stage: stage.value,
      friendJoined: friendJoined.value,
      localCameraReady: cameraReady.value,
      remoteCameraReady: remoteCameraReady.value,
      backgroundReady: isBackgroundReady.value,
      phase: capturePhase.value,
      rendering: rendering.value,
      shotsComplete: shotsComplete.value,
    }),
)
const localTileLabel = computed(() => 'Kamu')
const remoteTileLabel = computed(() => 'Teman')
const shouldMirrorLocalCamera = computed(() => shouldMirrorCamera(cameraStore.activeFacingMode))

const activeLayout = computed(() => getLayoutById(boothSetup.value.layoutId))
const activeTemplate = computed(() => getTemplateById(boothSetup.value.templateId))
const selectedCameraEffect = computed(() => getCameraEffectById(boothSetup.value.cameraEffectId))
const isCurrentEffectFaceTracking = computed(() =>
  isFaceTrackingEffect(boothSetup.value.cameraEffectId),
)
const videoFilterStyle = computed(() => ({ filter: getPhotoFilterCss(boothSetup.value.filterId) }))
const reviewShots = computed<Shot[]>(() =>
  composedShots.value.flatMap((shot, order) =>
    shot
      ? [
          {
            id: `booth-shot-${order}`,
            sessionId: 'booth-live',
            order,
            sourceType: 'camera' as const,
            blob: shot.blob,
            width: shot.width,
            height: shot.height,
            cameraEffectId: boothSetup.value.cameraEffectId,
            cameraEffectFrameMs: shot.cameraEffectFrameMs,
            faceBounds: shot.faceBounds.map((face) => ({ ...face })),
            createdAt: Date.now(),
          },
        ]
      : [],
  ),
)
const reviewShotUrls = ref<string[]>([])
const pageTitle = computed(() => {
  if (joinError.value) return 'Foto Duet'
  if (stage.value === 'output') return 'Hasil'
  if (stage.value === 'review') return 'Preview'
  return 'Foto Duet'
})
const countdownSeconds = computed(() => Math.round(boothSetup.value.countdownMs / 1000))
const pageSubtitle = computed(() => {
  if (joinError.value) return 'Booth tidak bisa dibuka.'
  if (!friendJoined.value) {
    return role.value === 'host'
      ? 'Menunggu teman'
      : statusMessage.value || 'Menghubungkan ke host…'
  }
  return 'Menunggu host'
})

function revokeReviewShotUrls() {
  reviewShotUrls.value.forEach((url) => {
    if (url) URL.revokeObjectURL(url)
  })
  reviewShotUrls.value = []
}

function syncReviewShotUrls() {
  revokeReviewShotUrls()
  reviewShotUrls.value = Array.from({ length: slotCount.value }, (_, index) => {
    const shot = composedShots.value[index]
    return shot ? URL.createObjectURL(shot.blob) : ''
  })
}

watch([composedShots, slotCount], () => {
  if (stage.value === 'review') syncReviewShotUrls()
})

watch(stage, (next) => {
  if (next === 'review') syncReviewShotUrls()
  if (next !== 'review') revokeReviewShotUrls()
})

async function copyValue(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    copyNotice.value = `${label} disalin.`
  } catch {
    copyNotice.value = `Gagal menyalin. Salin ${label.toLowerCase()} secara manual.`
  }

  if (copyNoticeTimer) window.clearTimeout(copyNoticeTimer)
  copyNoticeTimer = window.setTimeout(() => {
    copyNotice.value = ''
    copyNoticeTimer = null
  }, 2000)
}

function resolveRole(code: string): BoothPeerRole {
  const normalized = normalizeBoothCode(code)
  if (!normalized) return 'guest'
  const stored = sessionStorage.getItem(`${ROLE_KEY}.${normalized}`)
  if (stored === 'host') return 'host'
  return 'guest'
}

function persistPeer(code: string, peerId: string, nextRole: BoothPeerRole) {
  const normalized = normalizeBoothCode(code)
  if (!normalized) return
  sessionStorage.setItem(`${ROLE_KEY}.${normalized}`, nextRole)
  sessionStorage.setItem(`${PEER_KEY}.${normalized}`, peerId)
}

function readPeerId(code: string): string {
  const normalized = normalizeBoothCode(code)
  const stored = normalized ? sessionStorage.getItem(`${PEER_KEY}.${normalized}`) : null
  return stored || createPeerId()
}

function errorCopy(reason: BoothJoinError | 'full') {
  if (reason === 'missing') return 'Masukkan kode booth.'
  if (reason === 'malformed') return 'Kode booth tidak valid.'
  if (reason === 'full') return 'Booth sudah penuh. Maksimal 2 orang.'
  return 'Booth tidak ditemukan atau host belum online.'
}

function firstMissingMoment() {
  for (let index = 0; index < slotCount.value; index++) {
    if (!composedShots.value[index]) return index
  }
  return slotCount.value
}

function clearAutoCaptureTimer() {
  if (autoCaptureTimeout) {
    clearTimeout(autoCaptureTimeout)
    autoCaptureTimeout = null
  }
}

function stopAutoCapture() {
  autoCaptureRunning = false
  clearAutoCaptureTimer()
  stopAutoStartWatch?.()
  stopAutoStartWatch = null
}

function armAutoCapture() {
  if (boothSetup.value.autoCapture) autoCaptureRunning = true
}

function tryStartNextAutoPose() {
  if (role.value !== 'host') return

  const action = nextBoothAutoCaptureAction({
    enabled: boothSetup.value.autoCapture,
    running: autoCaptureRunning,
    shotsComplete: shotsComplete.value,
    stage: stage.value,
    friendJoined: friendJoined.value,
    canStart: canStart.value,
  })

  if (action !== 'wait') {
    stopAutoStartWatch?.()
    stopAutoStartWatch = null
  }

  if (action === 'stop') {
    stopAutoCapture()
    return
  }

  if (action === 'start') {
    startPose()
    return
  }

  if (!stopAutoStartWatch) {
    stopAutoStartWatch = watch([canStart, friendJoined, shotsComplete, stage], () => {
      tryStartNextAutoPose()
    })
  }
}

function scheduleNextAutoPose() {
  if (role.value !== 'host' || !autoCaptureRunning || !boothSetup.value.autoCapture) return
  clearAutoCaptureTimer()
  stopAutoStartWatch?.()
  stopAutoStartWatch = null
  autoCaptureTimeout = setTimeout(() => {
    autoCaptureTimeout = null
    tryStartNextAutoPose()
  }, BOOTH_AUTO_CAPTURE_GAP_MS)
}

function cancelBoothCountdown() {
  if (role.value !== 'host' || countdownValue.value == null) return
  const momentIndex = currentMoment.value
  stopAutoCapture()
  void stopBoothLiveCamClip()
  peerSession?.cancelMoment(momentIndex, 'cancelled')
}

function handleGlobalKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') cancelBoothCountdown()
}

function publishSetup(next: BoothSessionSetup) {
  const normalized = normalizeBoothSetup(next)
  if (boothSetupsEqual(boothSetup.value, normalized) && peerSession?.getSetup()) {
    boothSetup.value = normalized
    snapshotPendingHostSetup()
    return
  }
  peerBgStatus.value = null
  boothSetup.value = normalized
  snapshotPendingHostSetup()
  if (role.value === 'host') {
    if (normalized.virtualBackgroundId === 'custom' && activeBackgroundBlob) {
      void peerSession?.setSetup(normalized, activeBackgroundBlob)
    } else {
      peerSession?.setSetup(normalized)
    }
  }
}

function applyPendingHostSetup(code: string) {
  if (role.value !== 'host') return
  const pending = readPendingBoothSetup(code)
  if (!pending) return
  boothSetup.value = normalizeBoothSetup({
    layoutId: pending.layoutId,
    templateId: pending.templateId,
    slotCount: pending.slotCount,
    countdownMs: pending.countdownSeconds * 1000,
    autoCapture: pending.autoCapture,
    filterId: pending.filterId,
    cameraEffectId: pending.cameraEffectId,
    virtualBackgroundId: pending.virtualBackgroundId,
  })
}

function snapshotPendingHostSetup() {
  if (role.value !== 'host' || !identity.value) return
  writePendingBoothSetup({
    code: identity.value.code,
    layoutId: boothSetup.value.layoutId,
    templateId: boothSetup.value.templateId,
    slotCount: boothSetup.value.slotCount,
    countdownSeconds: Math.round(boothSetup.value.countdownMs / 1000),
    autoCapture: boothSetup.value.autoCapture,
    filterId: boothSetup.value.filterId,
    cameraEffectId: boothSetup.value.cameraEffectId,
    virtualBackgroundId: boothSetup.value.virtualBackgroundId,
  })
}

function openSessionConfig() {
  if (!canEditSessionConfig.value) return
  sessionConfigOpen.value = true
}

watch(sessionConfigOpen, (open) => {
  if (!open) return
  stopAutoCapture()
  sessionConfigError.value = ''
})

async function applySessionConfig(config: CaptureSessionConfig) {
  if (!canEditSessionConfig.value) return
  stopAutoCapture()
  sessionConfigBusy.value = true
  sessionConfigError.value = ''
  const session = peerSession
  const next = normalizeBoothSetup({
    ...boothSetup.value,
    ...config,
    countdownMs: config.countdownSeconds * 1000,
  })
  try {
    // Reuse its cached background asset so the camera and microphone keep running.
    await session?.setSetup(next)
    if (disposed || session !== peerSession) return
    boothSetup.value = next
    snapshotPendingHostSetup()
    sessionConfigOpen.value = false
  } catch {
    if (!disposed) sessionConfigError.value = 'Pengaturan belum tersimpan. Coba terapkan lagi.'
  } finally {
    sessionConfigBusy.value = false
  }
}

function handleFilterChange(filterId: string) {
  if (!canChangeSetup.value) return
  publishSetup({ ...boothSetup.value, filterId })
}

function handleEffectChange(cameraEffectId: string) {
  if (!canChangeSetup.value) return
  latestOverlayFaces.value = []
  latestOverlayFrameMs.value = 0
  publishSetup({ ...boothSetup.value, cameraEffectId })
}

async function handleBackgroundChange(virtualBackgroundId: string) {
  if (!canChangeSetup.value) return
  const nextRev = (boothSetup.value.revision ?? 0) + 1
  if (virtualBackgroundId === 'off') {
    customBackgroundFrame.value = null
    activeBackgroundBlob = null
  }
  const nextSetup: BoothSessionSetup = {
    ...boothSetup.value,
    virtualBackgroundId,
    virtualBackgroundAssetId:
      virtualBackgroundId === 'custom' ? boothSetup.value.virtualBackgroundAssetId : null,
    revision: nextRev,
  }
  publishSetup(nextSetup)
  if (backgroundProcessor.value) {
    await backgroundProcessor.value.configure(
      {
        id: virtualBackgroundId,
        customImage: customBackgroundFrame.value,
      },
      { mirrored: shouldMirrorLocalCamera.value },
    )
    syncLocalBackgroundStatus()
    updateTransportStream()
  }
}

async function handleCustomBackground(file: File) {
  if (!canChangeSetup.value) return
  const validation = validateCustomBackgroundFile(file)
  if (!validation.valid) {
    cameraError.value = validation.errors[0] ?? 'Gambar latar tidak valid.'
    return
  }

  try {
    statusMessage.value = 'Mengompres gambar latar...'
    const normalized = await normalizeHostCustomBackground(file)
    activeBackgroundBlob = normalized.blob
    const frame = await loadCustomVirtualBackgroundFrame(normalized.blob)
    customBackgroundFrame.value = frame
    cameraError.value = ''

    const assetId = `bg-${Date.now()}`
    const nextRev = (boothSetup.value.revision ?? 0) + 1
    const nextSetup: BoothSessionSetup = {
      ...boothSetup.value,
      virtualBackgroundId: 'custom',
      virtualBackgroundAssetId: assetId,
      revision: nextRev,
    }
    boothSetup.value = nextSetup
    peerBgStatus.value = null
    if (role.value === 'host' && peerSession) {
      await peerSession.setSetup(nextSetup, normalized.blob)
    }
    if (backgroundProcessor.value) {
      await backgroundProcessor.value.configure(
        {
          id: 'custom',
          customImage: frame,
        },
        { mirrored: shouldMirrorLocalCamera.value },
      )
      syncLocalBackgroundStatus()
      updateTransportStream()
    }
    statusMessage.value = 'Latar virtual diterapkan.'
  } catch (err) {
    console.error('Failed to process custom background:', err)
    cameraError.value = 'Gambar latar gagal diproses. Gunakan JPG, PNG, atau WebP.'
  }
}

function processCapturedBackground(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  applyVirtualBackgroundToCanvas(
    canvas,
    ctx,
    resolveVirtualBackgroundSpec(boothSetup.value.virtualBackgroundId, customBackgroundFrame.value),
  )
}

function syncLocalBackgroundStatus() {
  localBackgroundStatus.value = backgroundProcessor.value?.currentStatus ?? 'off'
}

function reportGuestBackgroundIfReady() {
  syncLocalBackgroundStatus()
  if (
    !shouldConfirmGuestBackgroundReady({
      role: role.value,
      processorStatus: localBackgroundStatus.value,
      backgroundId: boothSetup.value.virtualBackgroundId,
      hasCustomImage: Boolean(customBackgroundFrame.value),
    })
  ) {
    return
  }
  guestBackgroundStatus.value = 'ready'
  peerSession?.confirmBackgroundReady(
    boothSetup.value.revision ?? 1,
    boothSetup.value.virtualBackgroundAssetId ?? undefined,
  )
}

function setupBackgroundProcessor() {
  if (!videoRef.value || !stream) return
  if (backgroundProcessor.value) {
    backgroundProcessor.value.dispose()
  }

  localBackgroundStatus.value = 'off'
  backgroundProcessor.value = new CameraBackgroundProcessor({
    video: videoRef.value,
    rawStream: stream,
    mirrored: shouldMirrorLocalCamera.value,
    onStatusChange: (status, error) => {
      localBackgroundStatus.value = status
      if (status === 'error') {
        backgroundError.value = error ?? 'Segmentasi latar belakang gagal.'
        if (role.value === 'guest') {
          guestBackgroundStatus.value = 'error'
          peerSession?.reportBackgroundError(
            boothSetup.value.revision ?? 1,
            error ?? 'segmentation_error',
          )
        }
      } else if (status === 'ready') {
        backgroundError.value = null
        reportGuestBackgroundIfReady()
      } else if (status === 'off') {
        backgroundError.value = null
        if (role.value === 'guest') guestBackgroundStatus.value = 'off'
      }
    },
  })

  void backgroundProcessor.value
    .configure(
      {
        id: boothSetup.value.virtualBackgroundId,
        customImage: customBackgroundFrame.value,
      },
      { mirrored: shouldMirrorLocalCamera.value },
    )
    .then(() => {
      reportGuestBackgroundIfReady()
      updateTransportStream()
    })
}

function updateTransportStream() {
  roomTransport?.media?.setMicrophoneEnabled?.(microphoneEnabled.value)
  const videoSource = backgroundProcessor.value?.stream ?? stream
  const outbound = composeBoothMediaStream(videoSource, stream)
  if (outbound && roomTransport?.media) {
    roomTransport.media.attachLocalStream(outbound)
  }
}

async function retryBackground() {
  showBackgroundErrorModal.value = false
  backgroundError.value = null
  if (role.value === 'host') {
    if (boothSetup.value.virtualBackgroundId === 'custom' && activeBackgroundBlob) {
      await peerSession?.setSetup(boothSetup.value, activeBackgroundBlob)
    } else {
      peerSession?.setSetup(boothSetup.value)
    }
    if (backgroundProcessor.value) {
      await backgroundProcessor.value.configure(
        {
          id: boothSetup.value.virtualBackgroundId,
          customImage: customBackgroundFrame.value,
        },
        { mirrored: shouldMirrorLocalCamera.value },
      )
      syncLocalBackgroundStatus()
      updateTransportStream()
    }
  } else {
    guestBackgroundStatus.value = 'loading'
    if (
      boothSetup.value.virtualBackgroundId === 'custom' &&
      boothSetup.value.virtualBackgroundAssetId
    ) {
      peerSession?.requestBackgroundAsset(
        boothSetup.value.revision ?? 1,
        boothSetup.value.virtualBackgroundAssetId,
      )
    } else if (backgroundProcessor.value) {
      await backgroundProcessor.value.configure(
        { id: boothSetup.value.virtualBackgroundId },
        { mirrored: shouldMirrorLocalCamera.value },
      )
      updateTransportStream()
      reportGuestBackgroundIfReady()
    }
  }
}

async function fallbackToNormalBackground() {
  showBackgroundErrorModal.value = false
  backgroundError.value = null
  guestBackgroundStatus.value = 'off'
  customBackgroundFrame.value = null
  activeBackgroundBlob = null
  const previousRevision = boothSetup.value.revision ?? 1
  const nextRev = previousRevision + 1
  const updated: BoothSessionSetup = {
    ...boothSetup.value,
    virtualBackgroundId: 'off',
    virtualBackgroundAssetId: null,
    revision: nextRev,
  }
  boothSetup.value = updated
  if (role.value === 'host') {
    void peerSession?.setSetup(updated)
  } else {
    peerSession?.requestBackgroundFallback(previousRevision)
  }
  if (backgroundProcessor.value) {
    await backgroundProcessor.value.configure(
      { id: 'off' },
      { mirrored: shouldMirrorLocalCamera.value },
    )
    syncLocalBackgroundStatus()
    updateTransportStream()
  }
}

watch(videoRef, () => {
  void attachPreviewStream()
})

watch([remoteVideoRef, remoteStream], () => {
  startRemoteReadyPoll()
  void attachRemoteStream()
})

watch(friendJoined, (joined) => {
  if (!joined) {
    stopAutoCapture()
    if (capturePhase.value !== 'idle')
      peerSession?.cancelMoment(currentMoment.value, 'disconnected')
    return
  }
  void attachPreviewStream()
  void attachRemoteStream()
  startRemoteReadyPoll()
})

async function attachPreviewStream() {
  if (!videoRef.value || !stream) return
  if (videoRef.value.srcObject !== stream) videoRef.value.srcObject = stream
  try {
    await videoRef.value.play()
  } catch {
    // Autoplay can be blocked; the user can still start a pose after interaction.
  }
  refreshLocalVideoReady()
}

function refreshLocalVideoReady() {
  const video = videoRef.value
  localVideoReady.value = Boolean(
    video &&
    isRemotePreviewReady(video) &&
    stream?.getVideoTracks().some((track) => track.readyState === 'live'),
  )
  peerSession?.setCameraReady(cameraReady.value)
}

watch(cameraReady, (ready) => {
  peerSession?.setCameraReady(ready)
  if (!ready && capturePhase.value !== 'idle')
    peerSession?.cancelMoment(currentMoment.value, 'camera_unavailable')
})

function stopRemoteReadyPoll() {
  if (!remoteReadyTimer) return
  clearInterval(remoteReadyTimer)
  remoteReadyTimer = null
}

function refreshRemoteVideoReady() {
  const el = remoteVideoRef.value
  remoteVideoReady.value = el ? isRemotePreviewReady(el) : false
  if (remoteVideoReady.value) stopRemoteReadyPoll()
}

function startRemoteReadyPoll() {
  stopRemoteReadyPoll()
  refreshRemoteVideoReady()
  if (remoteVideoReady.value || !remoteStream.value) return
  remoteReadyTimer = setInterval(() => {
    void attachRemoteStream()
  }, 250)
}

async function attachRemoteStream() {
  const generation = ++remotePlaybackGeneration
  const el = remoteVideoRef.value
  if (!el) return

  const next = remoteStream.value
  if (!next) {
    stopRemoteReadyPoll()
    el.srcObject = null
    remoteVideoReady.value = false
    remoteAudioBlocked.value = false
    el.muted = speakerMuted.value
    return
  }

  if (el.srcObject !== next) el.srcObject = next
  el.muted = remotePlaybackMuted.value
  try {
    await el.play()
  } catch {
    if (disposed || generation !== remotePlaybackGeneration) return
    remoteAudioBlocked.value = !speakerMuted.value
    el.muted = true
    try {
      await el.play()
    } catch {
      // Autoplay can still be blocked until the user taps the tile.
    }
  }
  if (disposed || generation !== remotePlaybackGeneration) return
  refreshRemoteVideoReady()
}

async function unlockRemoteAudio() {
  const generation = ++remotePlaybackGeneration
  speakerMuted.value = false
  remoteAudioBlocked.value = false
  const el = remoteVideoRef.value
  if (!el) return
  el.muted = false
  if (!el.srcObject) return
  try {
    await el.play()
  } catch {
    if (disposed || generation !== remotePlaybackGeneration) return
    remoteAudioBlocked.value = true
    el.muted = true
  }
}

function toggleSpeaker() {
  if (remotePlaybackMuted.value) {
    void unlockRemoteAudio()
    return
  }
  remotePlaybackGeneration += 1
  speakerMuted.value = true
  remoteAudioBlocked.value = false
  if (remoteVideoRef.value) remoteVideoRef.value.muted = true
}

function bindRoomMedia(transport: BoothTransport) {
  unsubRemoteStream?.()
  roomTransport = transport
  unsubRemoteStream =
    transport.media?.subscribeRemoteStream((next) => {
      remoteStream.value = next
    }) ?? null
  updateTransportStream()
}

async function startCamera() {
  const generation = ++cameraGeneration
  bindMicrophoneStream(null)
  if (stream) {
    stopCamera(stream)
    stream = null
  }
  cameraError.value = ''
  cameraLive.value = false
  localVideoReady.value = false
  try {
    const nextStream = await initCamera({ audio: true })
    if (disposed || generation !== cameraGeneration) {
      stopCamera(nextStream)
      return
    }
    stream = nextStream
    bindMicrophoneStream(nextStream)
    for (const track of nextStream.getVideoTracks()) {
      track.addEventListener('ended', refreshLocalVideoReady, { once: true })
    }
    cameraLive.value = true
    liveCamAvailable.value = isLiveStripRenderingSupported()
    await nextTick()
    if (disposed || generation !== cameraGeneration) return
    setupBackgroundProcessor()
    updateTransportStream()
    await attachPreviewStream()
  } catch {
    if (disposed || generation !== cameraGeneration) return
    cameraLive.value = false
    cameraError.value = 'Kamera belum tersedia. Izinkan kamera lalu coba lagi untuk mengambil foto.'
  }
}

function stopPreview() {
  cameraGeneration += 1
  bindMicrophoneStream(null)
  if (stream) {
    stopCamera(stream)
    stream = null
  }
  cameraLive.value = false
  localVideoReady.value = false
  if (videoRef.value) videoRef.value.srcObject = null
}

function finishCountdownWaiter() {
  const resolve = countdownResolve
  countdownResolve = null
  resolve?.()
}

function stopCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
  countdownValue.value = null
}

function updateOverlayFaces(faces: FaceBounds[]) {
  latestOverlayFaces.value = faces.map((face) => ({ ...face }))
}

function updateOverlayFrame(frameMs: number) {
  latestOverlayFrameMs.value = frameMs
}

function startBoothLiveCamClip() {
  if (activeLiveCamRecording || !videoRef.value) return
  if (!isLiveStripRenderingSupported()) {
    liveCamAvailable.value = false
    return
  }

  const pairSlot = pairSlotForLayout(boothSetup.value.layoutId)
  const isBgActive = Boolean(backgroundProcessor.value?.isActive())
  const localSource = isBgActive ? backgroundProcessor.value?.canvas : videoRef.value
  if (!localSource) return

  try {
    activeLiveCamRecording = startPairLiveCamRecording({
      localVideo: localSource,
      remoteVideo: remoteVideoRef.value,
      width: pairSlot.width,
      height: pairSlot.height,
      localOnLeft: role.value === 'host',
      localMirrored: shouldMirrorLocalCamera.value,
      remoteMirrored: shouldMirrorLocalCamera.value,
    })
    liveCamRecordingActive.value = Boolean(activeLiveCamRecording)
    liveCamAvailable.value = liveCamRecordingActive.value || liveCamAvailable.value
  } catch {
    activeLiveCamRecording = null
    liveCamRecordingActive.value = false
  }
}

async function stopBoothLiveCamClip(delayMs = 0): Promise<LiveCamClip | null> {
  const recording = activeLiveCamRecording
  activeLiveCamRecording = null
  liveCamRecordingActive.value = false
  if (!recording) return null
  try {
    return await recording.stop(delayMs)
  } catch {
    return null
  }
}

async function captureCurrentMoment(
  session: BoothPeerSession,
  momentIndex: number,
  captureId: string,
) {
  const isCurrent = () =>
    !disposed &&
    session === peerSession &&
    activeCaptureId === captureId &&
    session.isCaptureActive(momentIndex, captureId)
  if (!isCurrent()) return
  if (!videoRef.value || !cameraReady.value) {
    session.cancelMoment(momentIndex, 'camera_unavailable')
    return
  }
  capturePhase.value = 'exchanging'

  try {
    const liveClipPromise = stopBoothLiveCamClip(450)
    const pairSlot = pairSlotForLayout(boothSetup.value.layoutId)
    const slot = {
      width: Math.floor(pairSlot.width / 2),
      height: pairSlot.height,
    }
    let still: { blob: Blob; width: number; height: number }
    if (backgroundProcessor.value?.isActive()) {
      const frame = await backgroundProcessor.value.captureStill({
        ...slot,
        mirrored: shouldMirrorLocalCamera.value,
      })
      still = {
        blob: frame.blob,
        width: frame.width,
        height: frame.height,
      }
    } else {
      still = await captureCoverFrame(videoRef.value, slot, {
        mirrored: shouldMirrorLocalCamera.value,
        processCanvas: processCapturedBackground,
      })
    }
    if (!isCurrent()) return
    await session.submitStill(
      momentIndex,
      {
        ...still,
        faceBounds: latestOverlayFaces.value.map((face) => ({ ...face })),
        cameraEffectFrameMs: latestOverlayFrameMs.value,
      },
      captureId,
    )
    const shot = await session.waitForComposed(momentIndex, 30_000, captureId)
    const liveClip = await liveClipPromise
    if (!isCurrent()) return
    const next = composedShots.value.slice()
    while (next.length < slotCount.value) next.push(undefined)
    next[momentIndex] = liveClip ? { ...shot, liveClip } : shot
    composedShots.value = next
    currentMoment.value = Math.min(slotCount.value, firstMissingMoment())
    if (
      isSessionComplete(
        next.flatMap((item, order) => (item ? [{ order }] : [])),
        slotCount.value,
      )
    ) {
      stopAutoCapture()
      stage.value = 'review'
      statusMessage.value = 'Strip siap ditinjau.'
    } else {
      stage.value = 'live'
      statusMessage.value =
        role.value === 'host' && autoCaptureRunning
          ? `Pose ${momentIndex + 1} tersimpan. Pose berikutnya otomatis.`
          : `Pose ${momentIndex + 1} tersimpan. Siap pose berikutnya.`
      scheduleNextAutoPose()
    }
  } catch {
    if (!isCurrent()) return
    stopAutoCapture()
    session.cancelMoment(momentIndex, 'capture_failed')
    statusMessage.value = 'Gagal mengambil still. Coba mulai pose lagi.'
  } finally {
    if (activeCaptureId === captureId && session === peerSession) {
      activeCaptureId = null
      capturePhase.value = 'idle'
    }
  }
}

function clearComposedMoment(momentIndex: number) {
  if (!composedShots.value[momentIndex]) return
  const next = composedShots.value.slice()
  next[momentIndex] = undefined
  composedShots.value = next
}

function applyCaptureReset() {
  reviewRevision += 1
  stopCountdown()
  finishCountdownWaiter()
  activeCaptureId = null
  capturePhase.value = 'idle'
  void stopBoothLiveCamClip()
  stopAutoCapture()
  composedShots.value = []
  currentMoment.value = 0
  stage.value = 'live'
  statusMessage.value = friendJoined.value
    ? role.value === 'host'
      ? 'Teman sudah masuk'
      : 'Menunggu host'
    : role.value === 'host'
      ? 'Menunggu teman'
      : 'Menghubungkan ke host…'
}

function syncComposedFromProtocol() {
  if (!peerSession) return
  const byOrder = peerSession.getComposedByOrder()
  const next: Array<ComposedPairShot | undefined> = Array.from({ length: slotCount.value })
  for (const { order, shot } of byOrder) {
    if (order >= 0 && order < next.length) {
      const existing = composedShots.value[order]
      next[order] = existing?.liveClip ? { ...shot, liveClip: existing.liveClip } : shot
    }
  }
  composedShots.value = next
}

function runCountdown(
  session: BoothPeerSession,
  momentIndex: number,
  countdownMs: number,
  captureId: string,
): Promise<void> {
  stopCountdown()
  finishCountdownWaiter()
  reviewRevision += 1
  activeCaptureId = captureId
  capturePhase.value = 'countdown'
  stage.value = 'live'
  clearComposedMoment(momentIndex)
  const totalSeconds = Math.max(1, Math.round(countdownMs / 1000))
  countdownValue.value = totalSeconds
  currentMoment.value = momentIndex
  statusMessage.value = `Pose ${momentIndex + 1} dari ${slotCount.value}`
  startBoothLiveCamClip()

  return new Promise((resolve) => {
    countdownResolve = resolve
    countdownTimer = setInterval(() => {
      if (session !== peerSession || !session.isCaptureActive(momentIndex, captureId)) {
        stopCountdown()
        finishCountdownWaiter()
        if (activeCaptureId === captureId) {
          activeCaptureId = null
          capturePhase.value = 'idle'
        }
        return
      }
      if (countdownValue.value == null) {
        finishCountdownWaiter()
        return
      }
      if (backgroundError.value) {
        stopCountdown()
        peerSession?.cancelMoment(momentIndex, 'background_error')
        showBackgroundErrorModal.value = true
        finishCountdownWaiter()
        return
      }
      if (countdownValue.value <= 1) {
        stopCountdown()
        void captureCurrentMoment(session, momentIndex, captureId).finally(() => {
          if (countdownResolve === resolve) countdownResolve = null
          resolve()
        })
        return
      }
      countdownValue.value -= 1
    }, 1000)
  })
}

function listenForRemoteCountdown(session: BoothPeerSession) {
  if (captureLoop) return
  captureLoop = (async () => {
    try {
      while (session === peerSession) {
        const start = await session.waitForStart()
        if (session !== peerSession) break
        const alreadyCaptured = session
          .getComposedByOrder()
          .some((entry) => entry.order === start.momentIndex)
        if (alreadyCaptured) continue
        if (!session.isCaptureActive(start.momentIndex, start.captureId)) continue
        await runCountdown(session, start.momentIndex, start.countdownMs, start.captureId)
      }
    } catch {
      // Session disposed or host left; presence copy handles the UI.
    }
  })()
}

function listenForRemoteSetup(session: BoothPeerSession) {
  if (setupLoop) return
  setupLoop = (async () => {
    try {
      while (session === peerSession) {
        const next = await session.waitForSetup()
        if (session !== peerSession || disposed) break
        const normalized = normalizeBoothSetup(next)
        boothSetup.value = normalized

        if (normalized.virtualBackgroundId !== 'custom') {
          customBackgroundFrame.value = null
          if (backgroundProcessor.value) {
            if (role.value === 'guest') {
              guestBackgroundStatus.value =
                normalized.virtualBackgroundId === 'off' ? 'off' : 'loading'
            }
            await backgroundProcessor.value.configure(
              { id: normalized.virtualBackgroundId },
              { mirrored: shouldMirrorLocalCamera.value },
            )
            if (session !== peerSession || disposed) break
            updateTransportStream()
            reportGuestBackgroundIfReady()
          }
        } else if (role.value === 'guest') {
          guestBackgroundStatus.value = 'loading'
        } else if (backgroundProcessor.value) {
          await backgroundProcessor.value.configure(
            {
              id: 'custom',
              customImage: customBackgroundFrame.value,
            },
            { mirrored: shouldMirrorLocalCamera.value },
          )
          if (session !== peerSession || disposed) break
          updateTransportStream()
          reportGuestBackgroundIfReady()
        }
      }
    } catch {
      // Session disposed.
    }
  })()
}

function listenForRemoteReset(session: BoothPeerSession) {
  if (resetLoop) return
  resetLoop = (async () => {
    try {
      while (session === peerSession) {
        await session.waitForReset()
        if (session !== peerSession || disposed) break
        applyCaptureReset()
      }
    } catch {
      // Session disposed.
    }
  })()
}

function startPose() {
  if (!peerSession || !canStart.value) return
  capturePhase.value = 'countdown'
  armAutoCapture()
  void attachPreviewStream()
  void attachRemoteStream()
  const momentIndex = firstMissingMoment()
  peerSession.startMoment(momentIndex, boothSetup.value.countdownMs)
}

function retakeShot(index: number) {
  if (
    role.value !== 'host' ||
    !peerSession ||
    rendering.value ||
    capturePhase.value !== 'idle' ||
    !friendJoined.value ||
    !cameraReady.value ||
    !remoteCameraReady.value ||
    !isBackgroundReady.value
  )
    return
  stopAutoCapture()
  capturePhase.value = 'countdown'
  stage.value = 'live'
  currentMoment.value = index
  const next = composedShots.value.slice()
  next[index] = undefined
  composedShots.value = next
  peerSession.startMoment(index, boothSetup.value.countdownMs)
}

function retakeAll() {
  if (
    role.value !== 'host' ||
    !peerSession ||
    rendering.value ||
    capturePhase.value !== 'idle' ||
    sessionConfigBusy.value
  )
    return
  stopAutoCapture()
  if (
    !window.confirm(
      `Ulang semua foto? ${capturedCount.value} foto akan dihapus untuk kedua peserta. Pengaturan sesi bisa diubah kembali; ruang dan audio tetap aktif.`,
    )
  ) {
    return
  }
  peerSession.resetCapture()
  applyCaptureReset()
}

function disposeSession() {
  connectionGeneration += 1
  connectionAbort?.abort()
  connectionAbort = null
  activeCaptureId = null
  capturePhase.value = 'idle'
  remoteCameraReady.value = false
  stopCountdown()
  finishCountdownWaiter()
  stopAutoCapture()
  void stopBoothLiveCamClip()
  stopRemoteReadyPoll()
  if (backgroundProcessor.value) {
    backgroundProcessor.value.dispose()
    backgroundProcessor.value = null
  }
  if (presenceTimer) {
    clearInterval(presenceTimer)
    presenceTimer = null
  }
  unsubRemoteStream?.()
  unsubRemoteStream = null
  roomTransport = null
  remoteStream.value = null
  remoteVideoReady.value = false
  peerSession?.dispose()
  peerSession = null
  captureLoop = null
  setupLoop = null
  resetLoop = null
}

async function renderBoothStrip() {
  if (rendering.value || capturePhase.value !== 'idle') return
  if (!shotsComplete.value || !activeLayout.value || !activeTemplate.value) {
    renderError.value = 'Foto booth belum lengkap. Ambil semua pose dulu.'
    return
  }
  const generation = connectionGeneration
  const revision = reviewRevision
  const setup = { ...boothSetup.value }
  const layout = activeLayout.value
  const template = activeTemplate.value
  const sessionId = createPeerId()
  const shots: Shot[] = composedShots.value.flatMap((shot, order) =>
    shot
      ? [
          {
            id: `${sessionId}:${order}`,
            sessionId,
            order,
            sourceType: 'camera' as const,
            blob: shot.blob,
            width: shot.width,
            height: shot.height,
            cameraEffectId: setup.cameraEffectId,
            cameraEffectFrameMs: shot.cameraEffectFrameMs,
            liveClipBlob: shot.liveClip?.blob ?? null,
            liveClipMimeType: shot.liveClip?.mimeType ?? null,
            liveClipDurationMs: shot.liveClip?.durationMs ?? null,
            liveClipWidth: shot.liveClip?.width ?? null,
            liveClipHeight: shot.liveClip?.height ?? null,
            liveClipMirrored: shot.liveClip?.mirrored ?? null,
            faceBounds: shot.faceBounds.map((face) => ({ ...face })),
            createdAt: Date.now(),
          },
        ]
      : [],
  )
  rendering.value = true
  renderError.value = ''
  savedToGallery.value = false
  statusMessage.value = 'Merender photo strip…'
  try {
    const decoration = createDefaultDecorationConfig(template, {
      filterId: setup.filterId,
      cameraEffectId: setup.cameraEffectId,
      virtualBackgroundId: setup.virtualBackgroundId,
    })
    const result = await renderSessionForOutput({
      sessionId,
      shots,
      layout,
      template,
      decoration,
      format: 'image/png',
    })
    if (disposed || generation !== connectionGeneration || revision !== reviewRevision) return
    const stored = result.render
    if (renderUrl.value) URL.revokeObjectURL(renderUrl.value)
    if (livePreviewUrl.value) URL.revokeObjectURL(livePreviewUrl.value)
    renderUrl.value = URL.createObjectURL(stored.blob)
    livePreviewUrl.value = stored.liveBlob ? URL.createObjectURL(stored.liveBlob) : ''
    outputBlob = stored.blob
    savedToGallery.value = result.persisted
    outputNotice.value = result.storageWarning ?? ''
    stage.value = 'output'
    statusMessage.value = result.persisted
      ? 'Photo strip siap diunduh dan tersimpan di galeri.'
      : 'Photo strip siap diunduh. Hasil belum tersimpan di galeri.'
  } catch (error) {
    if (disposed || generation !== connectionGeneration || revision !== reviewRevision) return
    console.error('Booth final render failed:', error)
    renderError.value =
      error instanceof Error ? error.message : 'Render gagal. Coba buat hasil akhir lagi.'
    statusMessage.value = 'Render gagal. Coba lagi.'
  } finally {
    if (!disposed && generation === connectionGeneration) rendering.value = false
  }
}

async function handleDownload() {
  if (!outputBlob) return
  outputBusy.value = true
  outputError.value = ''
  outputNotice.value = ''
  try {
    await downloadBlob(
      outputBlob,
      generateFilename(
        boothSetup.value.layoutId,
        boothSetup.value.templateId,
        getExtensionForMimeType(outputBlob.type),
      ),
    )
    outputNotice.value = 'Unduhan dimulai.'
  } catch {
    outputError.value = 'Gagal menyiapkan download. Coba buka hasil dari galeri.'
  } finally {
    outputBusy.value = false
  }
}

async function handleShare() {
  if (!outputBlob) return
  outputBusy.value = true
  outputError.value = ''
  outputNotice.value = ''
  try {
    const shared = await shareBlob(
      outputBlob,
      generateFilename(boothSetup.value.layoutId, boothSetup.value.templateId, 'png'),
    )
    if (shared === 'unsupported') {
      outputError.value =
        'Browser ini belum mendukung share file photo strip. Gunakan download sebagai fallback.'
    } else if (shared === 'shared') {
      outputNotice.value = 'Lembar bagikan dibuka.'
    }
  } catch {
    outputError.value = 'Gagal membuka share sheet. Gunakan download sebagai fallback.'
  } finally {
    outputBusy.value = false
  }
}

async function handleSave() {
  if (!outputBlob) return
  outputBusy.value = true
  outputError.value = ''
  outputNotice.value = ''
  try {
    const saved = await saveBlob(
      outputBlob,
      generateFilename(boothSetup.value.layoutId, boothSetup.value.templateId, 'png'),
    )
    outputNotice.value = saved
      ? 'Hasil berhasil disimpan.'
      : 'Simpan ke perangkat tidak tersedia atau dibatalkan. Unduh tetap bisa dipakai.'
    if (!saved) outputError.value = outputNotice.value
    if (!saved) outputNotice.value = ''
  } catch {
    outputError.value = 'Gagal menyimpan hasil. Gunakan download sebagai fallback.'
  } finally {
    outputBusy.value = false
  }
}

function handlePrint() {
  if (!outputBlob) return
  outputError.value = ''
  outputNotice.value = ''
  const opened = printBlob(outputBlob)
  if (!opened) {
    outputError.value = 'Popup print diblokir browser. Izinkan popup atau gunakan download.'
  }
}

function updatePresenceStatus(nextRole: BoothPeerRole) {
  if (!peerSession || joinError.value) return

  if (peerSession.getRejectedReason() === 'full') {
    joinError.value = 'full'
    statusMessage.value = 'Booth sudah penuh.'
    disposeSession()
    return
  }

  if (peerSession.getRemotePeerId()) {
    participantCount.value = 2
  } else {
    participantCount.value = 1
  }
  remoteCameraReady.value = peerSession.getRemoteCameraReady()
  refreshLocalVideoReady()

  if (rendering.value || stage.value === 'output') return
  if (capturePhase.value !== 'idle') return

  const protocolShots = peerSession.getComposedByOrder()
  if (protocolShots.length !== capturedCount.value) {
    syncComposedFromProtocol()
  }

  if (shotsComplete.value) {
    stage.value = 'review'
    statusMessage.value = 'Strip siap ditinjau.'
    return
  }

  if (capturedCount.value > 0 && participantCount.value >= 2) {
    statusMessage.value = `Pose ${capturedCount.value}/${slotCount.value}`
    return
  }

  if (participantCount.value >= 2) {
    connectionHelp.value = false
    waitStartedAt = Date.now()
    statusMessage.value = nextRole === 'host' ? '' : 'Menunggu host'
    return
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    connectionHelp.value = true
    statusMessage.value = 'Tidak ada internet'
    return
  }

  if (Date.now() - waitStartedAt >= CONNECTION_WAIT_MS) {
    connectionHelp.value = true
    statusMessage.value = nextRole === 'guest' ? 'Host belum online' : 'Menunggu teman'
    return
  }

  connectionHelp.value = false
  statusMessage.value = nextRole === 'host' ? 'Menunggu teman' : 'Menghubungkan ke host…'
}

async function connectSession(next: BoothIdentity, nextRole: BoothPeerRole) {
  const normalized = normalizeBoothCode(next.code)
  if (!normalized) return

  const peerId = readPeerId(next.code)
  persistPeer(next.code, peerId, nextRole)
  disposeSession()
  const generation = connectionGeneration
  const abort = new AbortController()
  connectionAbort = abort
  waitStartedAt = Date.now()
  connectionHelp.value = false

  try {
    const transport = await createBoothRoomTransport(normalized, nextRole, abort.signal)
    if (disposed || generation !== connectionGeneration) {
      transport.dispose?.()
      return
    }
    if (stream && videoRef.value) {
      setupBackgroundProcessor()
    }
    bindRoomMedia(transport)
    peerSession = createBoothPeerSession({
      peerId,
      role: nextRole,
      transport,
      setup: boothSetup.value,
    })
    peerSession.setCameraReady(cameraReady.value)
    listenForRemoteCountdown(peerSession)
    listenForRemoteSetup(peerSession)
    listenForRemoteReset(peerSession)

    const activePeerSession = peerSession
    activePeerSession.onBackgroundAsset(async ({ revision, assetId, blob }) => {
      const setupBeforeDecode = activePeerSession.getSetup()
      if (
        role.value !== 'guest' ||
        setupBeforeDecode?.virtualBackgroundId !== 'custom' ||
        setupBeforeDecode.virtualBackgroundAssetId !== assetId ||
        (setupBeforeDecode.revision ?? 1) !== revision
      ) {
        return
      }

      try {
        guestBackgroundStatus.value = 'loading'
        const frame = await loadCustomVirtualBackgroundFrame(blob)
        const setupAfterDecode = activePeerSession.getSetup()
        if (
          activePeerSession !== peerSession ||
          setupAfterDecode?.virtualBackgroundId !== 'custom' ||
          setupAfterDecode.virtualBackgroundAssetId !== assetId ||
          (setupAfterDecode.revision ?? 1) !== revision
        ) {
          return
        }
        customBackgroundFrame.value = frame
        if (backgroundProcessor.value) {
          await backgroundProcessor.value.configure(
            {
              id: 'custom',
              customImage: frame,
            },
            { mirrored: shouldMirrorLocalCamera.value },
          )
          if (disposed || activePeerSession !== peerSession) return
          updateTransportStream()
        }
        reportGuestBackgroundIfReady()
      } catch (err) {
        if (disposed || activePeerSession !== peerSession) return
        console.error('Failed to load guest background asset:', err)
        guestBackgroundStatus.value = 'error'
        activePeerSession.reportBackgroundError(revision, 'decode_error')
      }
    })

    activePeerSession.onPeerBackgroundStatus((status) => {
      if (disposed || activePeerSession !== peerSession) return
      if (role.value === 'host' && status.peerId === activePeerSession.peerId) return
      if (role.value === 'host') {
        const remotePeerId = activePeerSession.getRemotePeerId()
        if (remotePeerId && status.peerId !== remotePeerId) return
      }
      peerBgStatus.value = status
      if (status.status === 'error') {
        if (capturePhase.value !== 'idle')
          activePeerSession.cancelMoment(currentMoment.value, 'background_error')
        stopAutoCapture()
        showBackgroundErrorModal.value = true
      }
    })

    activePeerSession.onMomentCancelled(({ reason }) => {
      if (disposed || activePeerSession !== peerSession) return
      activeCaptureId = null
      capturePhase.value = 'idle'
      stopCountdown()
      finishCountdownWaiter()
      stopAutoCapture()
      void stopBoothLiveCamClip()
      if (reason === 'background_error' || reason === 'timeout') {
        showBackgroundErrorModal.value = true
      } else {
        statusMessage.value = 'Pose dibatalkan.'
      }
    })

    if (nextRole === 'host') {
      void activePeerSession.setSetup(
        boothSetup.value,
        boothSetup.value.virtualBackgroundId === 'custom' ? activeBackgroundBlob : null,
      )
    }
  } catch {
    if (disposed || generation !== connectionGeneration) return
    joinError.value = nextRole === 'guest' ? 'unknown' : joinError.value
    statusMessage.value = 'Signaling booth gagal. Coba buat booth baru.'
    return
  }

  presenceTimer = setInterval(() => {
    if (disposed || generation !== connectionGeneration || !peerSession) return
    peerSession.announce()
    updatePresenceStatus(nextRole)
  }, 400)

  if (nextRole === 'guest') {
    statusMessage.value = 'Menghubungkan ke host…'
  }
}

function retryConnection() {
  if (!identity.value) return
  connectSession(identity.value, role.value)
}

function enterRoom() {
  joinError.value = null
  const param = String(route.params.code ?? '')
  const byCode = joinBoothByCode(param)
  const byInvite = joinBoothByInvite(route.path)
  const result = byCode.ok ? byCode : byInvite

  if (!result.ok) {
    joinError.value = result.reason
    identity.value = null
    return
  }

  identity.value = result.identity
  role.value = resolveRole(result.identity.code)
  applyPendingHostSetup(result.identity.code)
  snapshotPendingHostSetup()
  inviteUrl.value = buildInviteUrl(window.location.origin, result.identity)
  participantCount.value = 1
  currentMoment.value = 0
  stage.value = 'live'
  statusMessage.value = role.value === 'host' ? 'Menunggu teman' : 'Menghubungkan ke host…'
  connectSession(result.identity, role.value)
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
  enterRoom()
  void startCamera()
})

watch(
  () => route.params.code,
  () => {
    composedShots.value = []
    stage.value = 'live'
    enterRoom()
  },
)

onUnmounted(() => {
  disposed = true
  remotePlaybackGeneration += 1
  disposeMicrophone()
  window.removeEventListener('keydown', handleGlobalKeydown)
  disposeSession()
  stopPreview()
  if (copyNoticeTimer) window.clearTimeout(copyNoticeTimer)
  if (renderUrl.value) URL.revokeObjectURL(renderUrl.value)
  if (livePreviewUrl.value) URL.revokeObjectURL(livePreviewUrl.value)
  revokeReviewShotUrls()
})
</script>

<template>
  <div :class="[ui.page, stage === 'live' && !joinError ? 'lg:h-dvh lg:overflow-hidden' : '']">
    <div :class="ui.header">
      <div :class="ui.headerGroup">
        <button
          :class="ui.iconButton"
          aria-label="Kembali ke Foto Duet"
          @click="router.push('/booth')"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <div class="min-w-0">
          <h1 :class="ui.title">{{ pageTitle }}</h1>
          <p v-if="joinError" :class="ui.subtitle">{{ pageSubtitle }}</p>
        </div>
      </div>
      <div v-if="!joinError" class="flex items-center gap-2 sm:gap-3">
        <input
          id="booth-invite-url"
          :value="inviteUrl"
          class="hidden"
          tabindex="-1"
          data-testid="booth-invite-url"
          aria-hidden="true"
          readonly
        />
        <button
          type="button"
          class="text-stc-text text-sm font-semibold tracking-[0.14em]"
          data-testid="booth-code"
          aria-label="Salin tautan booth"
          @click="copyValue(inviteUrl, 'Link')"
        >
          {{ formattedCode }}
        </button>
        <span :class="ui.badge">{{ role === 'host' ? 'Host' : 'Tamu' }}</span>
        <span :class="ui.badge">{{ countdownSeconds }}s</span>
        <span v-if="boothSetup.autoCapture" :class="ui.pinkBadge">Otomatis</span>
        <button
          v-if="role === 'host' && stage === 'live'"
          :class="ui.iconButton"
          aria-label="Ubah setup sesi"
          :disabled="!canEditSessionConfig"
          @click="openSessionConfig"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path
              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l-.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06.06a2 2 0 0 1 2.83 2.83l-.06-.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
            />
          </svg>
        </button>
      </div>
    </div>

    <BoothAudioControls
      v-if="!joinError && stage !== 'live'"
      class="px-4 pt-3 sm:px-5"
      :microphone-enabled="microphoneEnabled"
      :microphone-available="microphoneAvailable"
      :microphone-busy="microphoneBusy"
      :camera-ready="cameraLive"
      :speaker-muted="speakerMuted"
      :playback-blocked="remoteAudioBlocked"
      :notice="microphoneNotice"
      @toggle-microphone="toggleMicrophone"
      @toggle-speaker="toggleSpeaker"
    />

    <main
      :class="[
        'mx-auto flex min-h-0 w-full flex-1 flex-col',
        stage === 'live' && !joinError ? 'p-4 lg:p-6' : 'max-w-5xl gap-4 px-4 py-3 sm:px-5',
      ]"
    >
      <section v-if="joinError" :class="[ui.emptyPanel, 'max-w-lg']">
        <p class="text-stc-text text-lg font-semibold" role="alert">{{ errorCopy(joinError) }}</p>
        <p class="text-stc-text-soft mt-2 text-sm leading-normal">Minta link baru.</p>
        <button
          class="mt-6"
          :class="[ui.secondaryButton, 'sm:w-auto sm:self-center']"
          @click="router.push('/booth')"
        >
          Kembali ke Foto Duet
        </button>
      </section>

      <template v-else>
        <CaptureWorkspace v-show="stage === 'live'" panel-label="Kontrol Foto Duet">
          <template #toolbar>
            <BoothAudioControls
              v-if="stage === 'live'"
              :microphone-enabled="microphoneEnabled"
              :microphone-available="microphoneAvailable"
              :microphone-busy="microphoneBusy"
              :camera-ready="cameraLive"
              :speaker-muted="speakerMuted"
              :playback-blocked="remoteAudioBlocked"
              :notice="microphoneNotice"
              @toggle-microphone="toggleMicrophone"
              @toggle-speaker="toggleSpeaker"
            />
          </template>
          <template #preview>
            <div
              class="booth-preview border-stc-border relative mx-auto w-full shrink-0 overflow-hidden rounded-lg border bg-black"
              data-testid="booth-stage"
            >
              <div
                v-if="liveCamRecordingActive"
                data-testid="live-cam-recording"
                class="absolute top-3 left-3 z-20 inline-flex items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 text-xs font-semibold text-white"
              >
                <span class="bg-stc-pink inline-flex size-2 animate-pulse rounded-full" />
                Rec
              </div>
              <div
                v-if="
                  boothSetup.virtualBackgroundId !== 'off' &&
                  (role === 'guest'
                    ? guestBackgroundStatus !== 'ready' && guestBackgroundStatus !== 'off'
                    : peerBgStatus && peerBgStatus.status !== 'ready')
                "
                class="absolute top-3 right-3 z-20 inline-flex items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 text-xs font-semibold text-white"
              >
                <template v-if="role === 'guest'">
                  {{ guestBackgroundStatus === 'error' ? 'Latar gagal' : 'Memuat latar' }}
                </template>
                <template v-else>{{ hostPeerBackgroundLabel }}</template>
              </div>
              <div class="grid h-full grid-cols-2">
                <article
                  class="relative min-h-0 min-w-0 overflow-hidden bg-zinc-950"
                  :class="role === 'host' ? 'order-1' : 'order-2'"
                  data-testid="booth-local-tile"
                >
                  <video
                    ref="videoRef"
                    class="absolute inset-0 h-full w-full object-cover"
                    :class="[
                      shouldMirrorLocalCamera ? 'scale-x-[-1]' : '',
                      localBackgroundPreviewActive ? 'opacity-0' : '',
                    ]"
                    data-testid="booth-local-video"
                    autoplay
                    muted
                    playsinline
                    :style="localBackgroundPreviewActive ? undefined : videoFilterStyle"
                    @loadedmetadata="refreshLocalVideoReady"
                    @playing="refreshLocalVideoReady"
                    @emptied="refreshLocalVideoReady"
                  />
                  <VirtualBackgroundCanvas
                    :video-el="videoRef"
                    :background-id="boothSetup.virtualBackgroundId"
                    :custom-image="customBackgroundFrame"
                    :processor="backgroundProcessor"
                    :mirrored="shouldMirrorLocalCamera"
                    class="pointer-events-none absolute inset-0 z-[4] h-full w-full"
                    :style="localBackgroundPreviewActive ? videoFilterStyle : undefined"
                    @active="localBackgroundPreviewActive = $event"
                  />
                  <CameraEffectCanvas
                    v-if="selectedCameraEffect.id !== 'none' && !isCurrentEffectFaceTracking"
                    :effect-id="boothSetup.cameraEffectId"
                    animated
                    class="pointer-events-none absolute inset-0 z-[5] h-full w-full"
                    @frame="updateOverlayFrame"
                  />
                  <FaceTrackingOverlay
                    v-if="isCurrentEffectFaceTracking"
                    :video-el="videoRef"
                    :effect-id="boothSetup.cameraEffectId"
                    :mirrored="shouldMirrorLocalCamera"
                    class="pointer-events-none absolute inset-0 z-[5] h-full w-full"
                    @update:faces="updateOverlayFaces"
                    @update:frame-ms="updateOverlayFrame"
                  />
                  <div
                    v-if="!cameraReady"
                    class="absolute inset-0 flex items-center justify-center bg-zinc-950 px-3 text-center"
                  >
                    <p class="text-xs font-medium text-white/80">
                      {{ cameraError || 'Izinkan kamera dan mikrofon' }}
                    </p>
                  </div>
                  <p
                    class="absolute bottom-2 left-2 truncate text-xs font-semibold text-white drop-shadow"
                  >
                    {{ localTileLabel }}
                  </p>
                </article>

                <article
                  class="relative min-h-0 min-w-0 overflow-hidden bg-zinc-950"
                  :class="role === 'host' ? 'order-2' : 'order-1'"
                  data-testid="booth-remote-tile"
                >
                  <video
                    ref="remoteVideoRef"
                    class="absolute inset-0 h-full w-full object-cover"
                    :class="shouldMirrorLocalCamera ? 'scale-x-[-1]' : ''"
                    data-testid="booth-remote-video"
                    autoplay
                    :muted="remotePlaybackMuted"
                    playsinline
                    :style="videoFilterStyle"
                    @loadedmetadata="refreshRemoteVideoReady"
                    @resize="refreshRemoteVideoReady"
                    @playing="refreshRemoteVideoReady"
                  />
                  <div
                    v-if="!friendJoined || !remoteVideoReady"
                    class="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950/70"
                  >
                    <p class="text-xs font-medium text-white/80">Menunggu</p>
                  </div>
                  <button
                    v-else-if="remoteAudioBlocked && !speakerMuted"
                    type="button"
                    class="absolute inset-0 z-20 flex items-center justify-center bg-black/35"
                    data-testid="booth-remote-audio-unlock"
                    @click="unlockRemoteAudio"
                  >
                    <span
                      class="rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Ketuk untuk dengar
                    </span>
                  </button>
                  <p
                    class="absolute bottom-2 left-2 z-20 truncate text-xs font-semibold text-white drop-shadow"
                  >
                    {{ remoteTileLabel }}
                  </p>
                </article>
              </div>

              <div
                v-if="countdownValue != null"
                class="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/50"
                aria-live="assertive"
                data-testid="booth-countdown"
              >
                <p class="pointer-events-none text-6xl font-semibold text-white tabular-nums">
                  {{ countdownValue }}
                </p>
                <button
                  v-if="role === 'host'"
                  type="button"
                  class="mt-8 rounded-full border border-white/30 bg-white/10 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/20 active:scale-95"
                  @click="cancelBoothCountdown"
                >
                  Batal
                </button>
              </div>
            </div>
          </template>
          <template #actions>
            <div class="flex flex-col items-center gap-2">
              <button
                v-if="role === 'host'"
                class="inline-flex h-12 min-w-44 items-center justify-center rounded-full px-6 text-sm font-semibold transition-colors disabled:opacity-50 lg:w-full"
                :class="
                  canStart
                    ? 'bg-stc-pink hover:bg-stc-pink-strong text-white'
                    : 'bg-stc-bg-2 text-stc-text'
                "
                :disabled="!canStart"
                @click="startPose"
              >
                {{ hostStartLabel }}
              </button>
              <p v-else class="text-stc-text-soft text-sm font-medium">{{ pageSubtitle }}</p>
              <div class="flex items-center gap-1.5">
                <span
                  v-for="index in slotCount"
                  :key="index"
                  :class="[
                    'size-2 rounded-full',
                    index <= capturedCount ? 'bg-stc-pink' : 'bg-stc-bg-3',
                  ]"
                />
              </div>
              <p v-if="copyNotice" class="text-stc-text-soft text-xs">{{ copyNotice }}</p>
              <button
                v-if="cameraError && capturePhase === 'idle'"
                :class="ui.secondaryButton"
                @click="startCamera"
              >
                Coba kamera lagi
              </button>
              <button
                v-if="connectionHelp && !shotsComplete"
                :class="ui.secondaryButton"
                @click="retryConnection"
              >
                Coba lagi
              </button>
            </div>
          </template>
          <template #settings>
            <CaptureSessionSettings
              v-if="role === 'host'"
              v-model:open="sessionConfigOpen"
              class="mb-5"
              mode="duet"
              :model-value="sessionConfig"
              :disabled="!canManageSessionConfig"
              :busy="sessionConfigBusy"
              :captured-count="capturedCount"
              @apply="applySessionConfig"
              @restart="retakeAll"
            />
            <p v-if="sessionConfigError" :class="[ui.alertError, 'mb-4']" role="alert">
              {{ sessionConfigError }}
            </p>
            <BoothDecorationPicker
              v-if="role === 'host'"
              class="w-full min-w-0"
              kind="all"
              stacked
              :filter-id="boothSetup.filterId"
              :camera-effect-id="boothSetup.cameraEffectId"
              :virtual-background-id="boothSetup.virtualBackgroundId"
              :disabled="!canChangeSetup"
              @select-filter="handleFilterChange"
              @select-effect="handleEffectChange"
              @select-background="handleBackgroundChange"
              @custom-file="handleCustomBackground"
            />
            <div v-else class="text-stc-text-soft space-y-2 text-sm leading-relaxed">
              <p class="text-stc-text font-medium" data-testid="booth-session-summary">
                {{ activeTemplate?.name ?? 'Frame pilihan host' }} · {{ slotCount }} foto ·
                {{ countdownSeconds }} detik · {{ boothSetup.autoCapture ? 'Otomatis' : 'Manual' }}
              </p>
              <p v-if="capturedCount > 0" data-testid="capture-session-locked">
                Terkunci setelah foto pertama
              </p>
            </div>
          </template>
        </CaptureWorkspace>

        <div v-if="stage === 'review'" :class="[ui.pageContent, 'items-center gap-6 text-center']">
          <StripCanvasPreview
            :layout="activeLayout"
            :template-config="activeTemplate"
            :shots="reviewShots"
            :shot-urls="reviewShotUrls"
            :filter-id="boothSetup.filterId"
            :camera-effect-id="boothSetup.cameraEffectId"
            :interactive="role === 'host'"
            fit-viewport
            @retake="retakeShot"
          />
          <p v-if="renderError" :class="[ui.alertError, 'w-full max-w-xl']">{{ renderError }}</p>
          <div :class="[ui.bottomActions, 'max-w-xl']">
            <button
              v-if="role === 'host'"
              :class="[ui.secondaryButton, 'w-full sm:flex-1']"
              @click="retakeAll"
            >
              Ulang Semua
            </button>
            <button
              :class="[ui.primaryButton, 'w-full sm:flex-[2]']"
              :disabled="rendering"
              @click="renderBoothStrip"
            >
              {{ rendering ? 'Merender...' : 'Buat Hasil Akhir' }}
            </button>
          </div>
        </div>

        <section
          v-if="stage === 'output' && renderUrl"
          :class="[ui.pageContent, 'items-center gap-6']"
        >
          <div class="flex w-full flex-col items-center gap-6 md:flex-row md:justify-center">
            <figure class="flex flex-col items-center gap-2">
              <figcaption :class="ui.sectionLabel">Foto</figcaption>
              <img
                :src="renderUrl"
                alt="Photo strip Foto Duet"
                class="rendered-strip mx-auto block h-auto"
              />
            </figure>
            <figure v-if="livePreviewUrl" class="flex flex-col items-center gap-2">
              <figcaption :class="ui.sectionLabel">Live Cam</figcaption>
              <video
                :src="livePreviewUrl"
                class="rendered-strip mx-auto block h-auto"
                autoplay
                loop
                muted
                playsinline
                controls
              />
            </figure>
          </div>
          <p v-if="savedToGallery" class="text-stc-text-soft text-center text-sm">
            Tersimpan di galeri.
          </p>
          <div
            v-if="outputError || outputNotice"
            class="w-full max-w-xl"
            :class="outputError ? ui.alertError : ui.alert"
          >
            {{ outputError || outputNotice }}
          </div>
          <div :class="[ui.bottomActions, 'max-w-xl !flex-col justify-center sm:!flex-col']">
            <div class="flex w-full flex-col-reverse gap-3 sm:flex-row">
              <button
                :class="[ui.secondaryButton, 'w-full sm:flex-1']"
                @click="router.push('/booth')"
              >
                Foto Baru
              </button>
              <button
                :class="[ui.primaryButton, 'w-full sm:flex-[2]']"
                :disabled="outputBusy"
                @click="handleDownload"
              >
                Unduh PNG
              </button>
            </div>
            <button
              :class="ui.ghostButton"
              :aria-expanded="showMoreActions"
              aria-controls="booth-output-secondary-actions"
              @click="showMoreActions = !showMoreActions"
            >
              {{ showMoreActions ? 'Tutup opsi tambahan' : 'Lihat opsi tambahan' }}
            </button>
            <div
              v-if="showMoreActions"
              id="booth-output-secondary-actions"
              class="border-stc-border grid w-full grid-cols-2 gap-2 rounded-lg border p-2 sm:grid-cols-4"
            >
              <button
                v-if="capabilities.canShare"
                :class="ui.actionTile"
                :disabled="outputBusy"
                @click="handleShare"
              >
                Bagikan
              </button>
              <button
                v-if="capabilities.canSave"
                :class="ui.actionTile"
                :disabled="outputBusy"
                @click="handleSave"
              >
                Simpan
              </button>
              <button v-if="capabilities.canPrint" :class="ui.actionTile" @click="handlePrint">
                Cetak
              </button>
              <button :class="ui.actionTile" @click="router.push('/gallery')">Galeri</button>
            </div>
          </div>
        </section>
      </template>
    </main>

    <div
      v-if="showBackgroundErrorModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div class="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
        <div
          class="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-rose-100 text-rose-600"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h3 class="text-stc-text text-base font-bold">Latar Virtual Gagal Disiapkan</h3>
        <p class="text-stc-text-soft mt-2 text-xs leading-relaxed">
          Terjadi kendala saat menyinkronkan atau memproses latar virtual bersama. Anda bisa mencoba
          lagi atau menggunakan latar asli bersama.
        </p>
        <div class="mt-6 flex flex-col gap-2">
          <button type="button" :class="ui.primaryButton" @click="retryBackground">
            Coba Lagi
          </button>
          <button type="button" :class="ui.secondaryButton" @click="fallbackToNormalBackground">
            Gunakan Asli bersama
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.booth-preview {
  /* Pair-row slot is 4:3; two side-by-side tiles are each 2:3, matching strip output crop. */
  aspect-ratio: 4 / 3;
  width: 100%;
}

.rendered-strip {
  width: min(100%, 20rem);
  max-width: 20rem;
  max-height: calc(100dvh - 18rem);
  object-fit: contain;
}
</style>
