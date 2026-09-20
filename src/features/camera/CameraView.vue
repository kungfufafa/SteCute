<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  abandonIncompleteSession,
  createDefaultDecorationConfig,
  ensureSession,
  getSessionBackgroundAsset,
  getSessionShots,
  getSessionSnapshot,
  isSessionComplete,
  saveSessionBackgroundAsset,
  saveShot,
  updateSessionDecorationConfig,
} from '@/services/session'
import {
  persistCameraFlow,
  persistActiveSessionId,
  persistRetakeIndex,
  readCameraFlow,
  readPendingSessionConfig,
  readRetakeIndex,
  readStoredSessionId,
  writePendingSessionConfig,
} from '@/services/session/persist'
import { getTemplateById } from '@/templates'
import type { CaptureSessionConfig } from '@/services/session/capture-config'
import {
  reconfigureCameraSession,
  restartCameraSessionPhotos,
} from '@/services/session/capture-reconfigure'
import { useCameraStore } from '@/app/store/useCameraStore'
import { useCustomTemplateStore } from '@/app/store/useCustomTemplateStore'
import { useSessionStore } from '@/app/store/useSessionStore'
import {
  captureFrame,
  getCameraDeviceOptions,
  initCamera,
  shouldMirrorCamera,
  stopCamera,
  switchCamera,
  type CameraDeviceOption,
  type CapturedFrame,
} from '@/services/camera'
import { getCameraEffectById, isFaceTrackingEffect } from '@/services/camera-effects'
import {
  isLiveCamRecordingSupported,
  startLiveCamRecording,
  type LiveCamClip,
  type LiveCamRecording,
} from '@/services/live-cam'
import type { FaceBounds } from '@/services/face-tracking'
import { getStorageErrorMessage, isStorageQuotaError } from '@/services/storage'
import { getPhotoFilterById } from '@/services/filter'
import {
  CameraBackgroundProcessor,
  applyVirtualBackgroundToCanvas,
  clearCustomVirtualBackgroundFrame,
  loadCustomVirtualBackgroundFrame,
  resolveVirtualBackgroundSpec,
  setCustomVirtualBackgroundFrame,
  validateCustomBackgroundFile,
  type RgbaFrame,
} from '@/services/virtual-background'
import { ui } from '@/ui/styles'
import CameraEffectCanvas from '@/components/common/CameraEffectCanvas.vue'
import CaptureWorkspace from '@/components/common/CaptureWorkspace.vue'
import CaptureSessionSettings from '@/components/common/CaptureSessionSettings.vue'
import FaceTrackingOverlay from '@/components/common/FaceTrackingOverlay.vue'
import VirtualBackgroundCanvas from '@/components/common/VirtualBackgroundCanvas.vue'
import BoothDecorationPicker from '@/features/booth/BoothDecorationPicker.vue'

const router = useRouter()
const cameraStore = useCameraStore()
const sessionStore = useSessionStore()
const customTemplateStore = useCustomTemplateStore()

const videoRef = ref<HTMLVideoElement | null>(null)
const countdownActive = ref(false)
const countdownValue = ref(0)
const flashVisible = ref(false)
const cameraError = ref<string | null>(null)
const backgroundError = ref<string | null>(null)
const backgroundProcessor = ref<CameraBackgroundProcessor | null>(null)
const liveCamAvailable = ref(false)
const liveCamRecordingActive = ref(false)
const latestOverlayFaces = ref<FaceBounds[]>([])
const latestOverlayFrameMs = ref(0)
const customBackgroundFrame = ref<RgbaFrame | null>(null)
const virtualBackgroundPreviewActive = ref(false)
const cameraDevices = ref<CameraDeviceOption[]>([])
const cameraPickerOpen = ref(false)
const isSwitchingCamera = ref(false)
const isCapturing = ref(false)
const cameraReady = ref(false)
const sessionSettingsOpen = ref(false)
const isApplyingSessionSettings = ref(false)
const unavailableKind = ref<'missing' | 'in-use' | 'constraint'>('missing')
let stream: MediaStream | null = null
let setupGeneration = 0
let countdownTimer: ReturnType<typeof setInterval> | null = null
let autoCaptureTimeout: ReturnType<typeof setTimeout> | null = null
let autoCaptureRunning = false
let activeLiveCamRecording: LiveCamRecording | null = null

const activeTemplate = computed(
  () =>
    customTemplateStore.getTemplateById(sessionStore.templateId) ??
    getTemplateById(sessionStore.templateId),
)
const captureSessionConfig = computed<CaptureSessionConfig>(() => ({
  layoutId: sessionStore.layoutId,
  templateId: sessionStore.templateId,
  slotCount: sessionStore.slotCount,
  countdownSeconds: sessionStore.countdownSeconds,
  autoCapture: sessionStore.autoCapture,
}))
const capturedCount = computed(() => sessionStore.shotIds.filter(Boolean).length)
const sessionSettingsDisabled = computed(
  () => !cameraReady.value || countdownActive.value || isCapturing.value || isSwitchingCamera.value,
)
const shotProgressLabel = computed(
  () => `Foto ${sessionStore.currentShotIndex + 1} dari ${sessionStore.slotCount}`,
)
const cameraRecoverySteps = [
  'Buka pengaturan browser',
  'Cari izin Kamera',
  'Ubah menjadi Izinkan',
  'Muat ulang halaman',
]
const selectedFilter = computed(() => getPhotoFilterById(sessionStore.filterId))
const selectedCameraEffect = computed(() => getCameraEffectById(sessionStore.cameraEffectId))
const videoFilterStyle = computed(() => ({ filter: selectedFilter.value.cssFilter }))
const canChangeFilter = computed(
  () =>
    !countdownActive.value &&
    !isCapturing.value &&
    !sessionSettingsOpen.value &&
    !isApplyingSessionSettings.value &&
    sessionStore.currentShotIndex === 0 &&
    !sessionStore.shotIds.some(Boolean),
)
const isCurrentEffectFaceTracking = computed(() =>
  isFaceTrackingEffect(sessionStore.cameraEffectId),
)
const activeCamera = computed(
  () =>
    cameraDevices.value.find((device) => device.deviceId === cameraStore.activeDeviceId) ?? null,
)
const activeCameraFacingMode = computed(() => {
  const deviceFacingMode = activeCamera.value?.facingMode
  return deviceFacingMode && deviceFacingMode !== 'unknown'
    ? deviceFacingMode
    : cameraStore.activeFacingMode
})
const shouldMirrorActiveCamera = computed(() => shouldMirrorCamera(activeCameraFacingMode.value))
const activeCameraLabel = computed(
  () => activeCamera.value?.label ?? (cameraStore.activeDeviceLabel || 'Kamera aktif'),
)
const canSwitchCamera = computed(
  () =>
    cameraReady.value &&
    cameraDevices.value.length > 1 &&
    !countdownActive.value &&
    !isSwitchingCamera.value &&
    !isCapturing.value &&
    !sessionSettingsOpen.value &&
    !isApplyingSessionSettings.value,
)
const unavailableTitle = computed(() => {
  if (unavailableKind.value === 'in-use') return 'Kamera Sedang Dipakai'
  if (unavailableKind.value === 'constraint') return 'Kamera Gagal Dibuka'
  return 'Tidak Ada Kamera'
})
const unavailableCopy = computed(() => {
  if (unavailableKind.value === 'in-use') {
    return 'Kamera perangkat sedang dipakai aplikasi lain. Tutup aplikasi itu, lalu coba lagi.'
  }
  if (unavailableKind.value === 'constraint') {
    return 'Browser tidak bisa membuka kamera dengan pengaturan saat ini. Coba ganti kamera atau muat ulang halaman.'
  }
  return 'Perangkat ini tidak memiliki kamera atau sedang dipakai aplikasi lain.'
})

watch(sessionSettingsOpen, (open) => {
  if (!open) return
  // Opening settings pauses the next automatic shot without replacing the live stream.
  if (autoCaptureTimeout) {
    clearTimeout(autoCaptureTimeout)
    autoCaptureTimeout = null
  }
  autoCaptureRunning = false
})

function openSessionSettings() {
  if (capturedCount.value > 0 || sessionSettingsDisabled.value || isApplyingSessionSettings.value)
    return
  sessionSettingsOpen.value = true
}

async function applySessionSettings(config: CaptureSessionConfig) {
  const sessionId = sessionStore.sessionId
  if (
    !sessionId ||
    capturedCount.value > 0 ||
    sessionSettingsDisabled.value ||
    isApplyingSessionSettings.value
  )
    return
  const template =
    customTemplateStore.getTemplateById(config.templateId) ?? getTemplateById(config.templateId)
  if (!template) return

  const generation = setupGeneration
  isApplyingSessionSettings.value = true
  cameraError.value = null
  try {
    const updated = await reconfigureCameraSession(sessionId, config, template)
    if (generation !== setupGeneration || sessionStore.sessionId !== sessionId) return

    sessionStore.restoreFromSession(updated.session, updated.shots)
    sessionStore.countdownSeconds = config.countdownSeconds
    sessionStore.autoCapture = config.autoCapture
    sessionStore.setCapturing()
    persistRetakeIndex(null)
    writePendingSessionConfig({ ...config, source: 'camera' })
    persistCameraFlow({
      countdownSeconds: config.countdownSeconds,
      autoCapture: config.autoCapture,
    })
    sessionSettingsOpen.value = false
  } catch (error) {
    if (generation !== setupGeneration) return
    console.error('Failed to update camera session settings:', error)
    cameraError.value = isStorageQuotaError(error)
      ? getStorageErrorMessage(error)
      : 'Pengaturan sesi gagal disimpan. Foto sebelumnya masih tersedia. Coba lagi.'
  } finally {
    isApplyingSessionSettings.value = false
  }
}

async function restartSessionPhotos() {
  const sessionId = sessionStore.sessionId
  if (
    !sessionId ||
    capturedCount.value === 0 ||
    sessionSettingsDisabled.value ||
    isApplyingSessionSettings.value
  )
    return
  if (
    !window.confirm(
      `Ulang semua foto? ${capturedCount.value} foto yang sudah diambil akan dihapus. Kamera dan pengaturan sesi tetap digunakan.`,
    )
  )
    return

  const generation = setupGeneration
  isApplyingSessionSettings.value = true
  cameraError.value = null
  cancelCountdown()
  try {
    const updated = await restartCameraSessionPhotos(sessionId)
    if (generation !== setupGeneration || sessionStore.sessionId !== sessionId) return
    sessionStore.restoreFromSession(updated.session, updated.shots)
    sessionStore.setCapturing()
    persistRetakeIndex(null)
    sessionSettingsOpen.value = false
  } catch (error) {
    if (generation !== setupGeneration || sessionStore.sessionId !== sessionId) return
    console.error('Failed to restart camera session photos:', error)
    cameraError.value = 'Foto belum bisa diulang. Foto sebelumnya masih tersedia. Coba lagi.'
  } finally {
    if (generation === setupGeneration) isApplyingSessionSettings.value = false
  }
}

watch(videoRef, () => {
  void attachPreviewStream()
})

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
  void setupCamera()
})

function handleGlobalKeydown(event: Event) {
  if (!('key' in event)) return

  if (event.key === 'Escape') {
    closeCameraPicker()
    cancelCountdown()
    return
  }

  if (
    event.key === ' ' &&
    cameraStore.permissionState === 'granted' &&
    !cameraPickerOpen.value &&
    !sessionSettingsOpen.value &&
    !isApplyingSessionSettings.value
  ) {
    event.preventDefault()
    runCountdownAndCapture()
  }
}

async function attachPreviewStream(generation = setupGeneration) {
  if (generation !== setupGeneration) return
  const video = videoRef.value
  if (!video || !stream) return

  if (video.srcObject !== stream) {
    video.srcObject = stream
  }

  try {
    await video.play()
  } catch (error) {
    console.warn('Camera preview play() was blocked:', error)
  }

  await waitForPreviewPixels(generation)
}

async function waitForPreviewPixels(generation = setupGeneration) {
  const video = videoRef.value
  if (!video || generation !== setupGeneration) return
  if (video.videoWidth > 0 && video.videoHeight > 0) return

  await new Promise<void>((resolve) => {
    const finish = () => {
      window.clearTimeout(timeout)
      video.removeEventListener('loadeddata', onReady)
      video.removeEventListener('loadedmetadata', onReady)
      resolve()
    }
    const onReady = () => {
      if (video.videoWidth > 0) finish()
    }
    const timeout = window.setTimeout(finish, 2500)
    video.addEventListener('loadeddata', onReady)
    video.addEventListener('loadedmetadata', onReady)
    if (video.videoWidth > 0) finish()
  })
}

async function refreshCameraDevices() {
  try {
    cameraDevices.value = await getCameraDeviceOptions()
  } catch (error) {
    console.warn('Failed to enumerate cameras:', error)
    cameraDevices.value = []
  }
}

function openCameraPicker() {
  if (!canSwitchCamera.value) return
  cameraPickerOpen.value = true
}

function closeCameraPicker() {
  cameraPickerOpen.value = false
}

function applyRetakeIndex() {
  const retakeIndex = readRetakeIndex()
  if (retakeIndex == null || retakeIndex >= sessionStore.slotCount) return
  sessionStore.currentShotIndex = retakeIndex
}

function applyCameraFlow() {
  const flow = readCameraFlow()
  if (!flow) return
  sessionStore.countdownSeconds = flow.countdownSeconds
  sessionStore.autoCapture = flow.autoCapture
}

function sessionMatchesConfig(
  session: { layoutId: string; templateId: string; slotCount: number },
  config: { layoutId: string; templateId: string; slotCount: number },
) {
  return (
    session.layoutId === config.layoutId &&
    session.templateId === config.templateId &&
    session.slotCount === config.slotCount
  )
}

async function restoreStoredCameraSession(requireConfig?: {
  layoutId: string
  templateId: string
  slotCount: number
}) {
  const storedId = readStoredSessionId()
  if (!storedId) return

  const snapshot = await getSessionSnapshot(storedId)
  if (
    !snapshot ||
    snapshot.session.captureSource !== 'camera' ||
    snapshot.session.status === 'completed' ||
    snapshot.session.finalRenderId
  ) {
    return
  }

  if (requireConfig && !sessionMatchesConfig(snapshot.session, requireConfig)) {
    await abandonIncompleteSession(storedId)
    persistActiveSessionId(null)
    sessionStore.sessionId = null
    return
  }

  sessionStore.restoreFromSession(snapshot.session, snapshot.shots)
  applyCameraFlow()
  applyRetakeIndex()
  sessionStore.setCapturing()
}

async function restoreCameraBackgroundAsset(assetId: string | null | undefined) {
  if (!assetId) {
    customBackgroundFrame.value = null
    clearCustomVirtualBackgroundFrame()
    return
  }

  try {
    const blob = await getSessionBackgroundAsset(assetId)
    if (!blob) throw new Error('Background asset is missing')
    const frame = await loadCustomVirtualBackgroundFrame(blob)
    customBackgroundFrame.value = frame
    setCustomVirtualBackgroundFrame(frame)
  } catch (err) {
    customBackgroundFrame.value = null
    clearCustomVirtualBackgroundFrame()
    console.warn('Could not restore session background asset:', err)
  }
}

async function setupCamera() {
  const generation = ++setupGeneration
  cameraReady.value = false
  sessionStore.setCapturing()
  if (cameraStore.permissionState !== 'granted') {
    cameraStore.setPermissionState('prompt')
  }
  cameraStore.setStreamReady(false)
  cameraError.value = null
  liveCamAvailable.value = false

  if (stream) {
    stopCamera(stream)
    stream = null
  }

  try {
    try {
      await customTemplateStore.loadPersistedTemplates()
    } catch (error) {
      console.warn('Failed to load custom blanko templates:', error)
    }
    if (generation !== setupGeneration) return

    const pendingConfig = readPendingSessionConfig('camera')
    if (pendingConfig) {
      sessionStore.layoutId = pendingConfig.layoutId
      sessionStore.templateId = pendingConfig.templateId
      sessionStore.slotCount = pendingConfig.slotCount
      sessionStore.countdownSeconds = pendingConfig.countdownSeconds
      sessionStore.autoCapture = pendingConfig.autoCapture
      persistCameraFlow({
        countdownSeconds: pendingConfig.countdownSeconds,
        autoCapture: pendingConfig.autoCapture,
      })

      if (!sessionStore.sessionId) {
        await restoreStoredCameraSession(pendingConfig)
      } else if (!sessionMatchesConfig(sessionStore, pendingConfig)) {
        await abandonIncompleteSession(sessionStore.sessionId)
        sessionStore.sessionId = null
      }
    } else if (!sessionStore.sessionId) {
      await restoreStoredCameraSession()
    }

    if (generation !== setupGeneration) return

    if (sessionStore.virtualBackgroundId === 'custom') {
      await restoreCameraBackgroundAsset(sessionStore.virtualBackgroundAssetId)
    } else {
      customBackgroundFrame.value = null
      clearCustomVirtualBackgroundFrame()
    }

    if (generation !== setupGeneration) return

    const nextStream = await initCamera()
    if (generation !== setupGeneration) {
      stopCamera(nextStream)
      return
    }

    stream = nextStream
    liveCamAvailable.value = isLiveCamRecordingSupported(stream)
    await nextTick()
    await attachPreviewStream(generation)
    setupBackgroundProcessor()
    await refreshCameraDevices()

    if (generation !== setupGeneration) return

    try {
      const sessionId = await ensureSession(sessionStore.sessionId, {
        layoutId: sessionStore.layoutId,
        templateId: sessionStore.templateId,
        slotCount: sessionStore.slotCount,
        captureSource: 'camera',
        decoration: createDefaultDecorationConfig(activeTemplate.value, {
          filterId: sessionStore.filterId,
          cameraEffectId: sessionStore.cameraEffectId,
          virtualBackgroundId: sessionStore.virtualBackgroundId,
          virtualBackgroundAssetId: sessionStore.virtualBackgroundAssetId,
        }),
      })

      if (generation !== setupGeneration) return

      if (sessionStore.sessionId !== sessionId) {
        sessionStore.startSession(sessionId, 'camera', sessionStore.slotCount)
      }

      sessionStore.setCapturing()
      persistCameraFlow({
        countdownSeconds: sessionStore.countdownSeconds,
        autoCapture: sessionStore.autoCapture,
      })
      applyRetakeIndex()
      await persistCameraDecoration(sessionId)
      if (generation === setupGeneration) {
        cameraReady.value = Boolean(videoRef.value && videoRef.value.videoWidth > 0)
      }
    } catch (error) {
      console.error('Failed to prepare camera session:', error)
      cameraError.value = isStorageQuotaError(error)
        ? getStorageErrorMessage(error)
        : 'Gagal menyiapkan sesi kamera. Coba lagi.'
      cameraReady.value = false
    }
  } catch (error) {
    if (generation !== setupGeneration) return
    const errorName = error instanceof DOMException ? error.name : ''
    const isDeniedError = errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError'
    const isMissingError = errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError'
    const isInUseError = errorName === 'NotReadableError' || errorName === 'TrackStartError'
    const isConstraintError = errorName === 'OverconstrainedError' || errorName === 'AbortError'

    if (isDeniedError) {
      cameraStore.setPermissionState('denied')
    } else if (isMissingError) {
      unavailableKind.value = 'missing'
      cameraStore.setPermissionState('unavailable')
    } else if (isInUseError) {
      unavailableKind.value = 'in-use'
      cameraStore.setPermissionState('unavailable')
    } else if (isConstraintError) {
      unavailableKind.value = 'constraint'
      cameraStore.setPermissionState('unavailable')
    } else {
      console.error('Camera init failed:', error)
      unavailableKind.value = 'constraint'
      cameraStore.setPermissionState('unavailable')
    }
  }
}

async function persistCameraDecoration(sessionId: string) {
  await updateSessionDecorationConfig(
    sessionId,
    createDefaultDecorationConfig(activeTemplate.value, {
      filterId: sessionStore.filterId,
      cameraEffectId: sessionStore.cameraEffectId,
      virtualBackgroundId: sessionStore.virtualBackgroundId,
      virtualBackgroundAssetId: sessionStore.virtualBackgroundAssetId,
    }),
  )
}

async function selectFilter(filterId: string) {
  if (!canChangeFilter.value && filterId !== sessionStore.filterId) return

  sessionStore.setFilterId(filterId)

  if (!sessionStore.sessionId) return

  try {
    await persistCameraDecoration(sessionStore.sessionId)
  } catch (error) {
    console.error('Failed to save camera filter:', error)
    cameraError.value = 'Efek kamera gagal disimpan. Coba pilih efek lagi.'
  }
}

async function selectCameraEffect(effectId: string) {
  if (!canChangeFilter.value && effectId !== sessionStore.cameraEffectId) return

  sessionStore.setCameraEffectId(effectId)
  latestOverlayFaces.value = []
  latestOverlayFrameMs.value = 0

  if (!sessionStore.sessionId) return

  try {
    await persistCameraDecoration(sessionStore.sessionId)
  } catch (error) {
    console.error('Failed to save camera overlay:', error)
    cameraError.value = 'Overlay kamera gagal disimpan. Coba pilih overlay lagi.'
  }
}

async function selectVirtualBackground(backgroundId: string) {
  if (!canChangeFilter.value && backgroundId !== sessionStore.virtualBackgroundId) return

  sessionStore.setVirtualBackgroundId(backgroundId)
  backgroundError.value = null

  if (backgroundProcessor.value) {
    void backgroundProcessor.value.configure(
      {
        id: backgroundId,
        customImage: customBackgroundFrame.value,
      },
      { mirrored: shouldMirrorActiveCamera.value },
    )
  }

  if (!sessionStore.sessionId) return

  try {
    await persistCameraDecoration(sessionStore.sessionId)
  } catch (error) {
    console.error('Failed to save virtual background:', error)
    backgroundError.value = 'Latar virtual gagal disimpan. Coba pilih latar lagi.'
  }
}

async function handleCustomBackground(file: File) {
  if (!canChangeFilter.value && sessionStore.virtualBackgroundId !== 'custom') return

  const validation = validateCustomBackgroundFile(file)
  if (!validation.valid) {
    backgroundError.value = validation.errors[0] ?? 'Gambar latar tidak valid.'
    return
  }

  try {
    const frame = await loadCustomVirtualBackgroundFrame(file)
    customBackgroundFrame.value = frame
    setCustomVirtualBackgroundFrame(frame)
    backgroundError.value = null

    if (sessionStore.sessionId) {
      const assetId = crypto.randomUUID()
      await saveSessionBackgroundAsset(sessionStore.sessionId, assetId, file)
      sessionStore.setVirtualBackgroundAssetId(assetId)
    }

    await selectVirtualBackground('custom')
  } catch (error) {
    console.error('Failed to load virtual background image:', error)
    backgroundError.value = 'Gambar latar gagal dibaca. Gunakan JPG, PNG, atau WebP.'
  }
}

async function retryVirtualBackground() {
  backgroundError.value = null
  if (backgroundProcessor.value) {
    await backgroundProcessor.value.configure(
      {
        id: sessionStore.virtualBackgroundId,
        customImage: customBackgroundFrame.value,
      },
      { mirrored: shouldMirrorActiveCamera.value },
    )
  }
}

async function fallbackToOriginalBackground() {
  backgroundError.value = null
  await selectVirtualBackground('off')
}

function setupBackgroundProcessor() {
  if (!videoRef.value) return
  if (backgroundProcessor.value) {
    backgroundProcessor.value.dispose()
  }

  backgroundProcessor.value = new CameraBackgroundProcessor({
    video: videoRef.value,
    rawStream: stream,
    mirrored: shouldMirrorActiveCamera.value,
    onStatusChange: (status, error) => {
      if (status === 'error') {
        backgroundError.value = error ?? 'Segmentasi latar belakang gagal.'
      } else if (status === 'ready' || status === 'off') {
        backgroundError.value = null
      }
    },
  })

  void backgroundProcessor.value.configure(
    {
      id: sessionStore.virtualBackgroundId,
      customImage: customBackgroundFrame.value,
    },
    { mirrored: shouldMirrorActiveCamera.value },
  )
}

function processCapturedBackground(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  applyVirtualBackgroundToCanvas(
    canvas,
    ctx,
    resolveVirtualBackgroundSpec(sessionStore.virtualBackgroundId, customBackgroundFrame.value),
  )
}

function updateOverlayFaces(faces: FaceBounds[]) {
  latestOverlayFaces.value = faces.map((face) => ({ ...face }))
}

function updateOverlayFrame(frameMs: number) {
  latestOverlayFrameMs.value = frameMs
}

function getCaptureCameraEffectId() {
  return sessionStore.cameraEffectId
}

onUnmounted(() => {
  setupGeneration += 1
  window.removeEventListener('keydown', handleGlobalKeydown)

  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }

  if (autoCaptureTimeout) {
    clearTimeout(autoCaptureTimeout)
    autoCaptureTimeout = null
  }

  autoCaptureRunning = false
  void stopActiveLiveCamRecording()

  if (backgroundProcessor.value) {
    backgroundProcessor.value.dispose()
    backgroundProcessor.value = null
  }

  if (stream) {
    stopCamera(stream)
    stream = null
  }
})

async function handleSwitchCamera() {
  if (!stream || isSwitchingCamera.value || countdownActive.value) return

  if (cameraDevices.value.length === 0) {
    await refreshCameraDevices()
  }

  if (cameraDevices.value.length <= 1) return

  if (cameraDevices.value.length > 2) {
    openCameraPicker()
    return
  }

  const currentIndex = cameraDevices.value.findIndex(
    (device) => device.deviceId === cameraStore.activeDeviceId,
  )
  const nextIndex = (currentIndex + 1) % cameraDevices.value.length
  await selectCameraDevice(cameraDevices.value[nextIndex].deviceId)
}

async function selectCameraDevice(deviceId: string) {
  if (!stream || isSwitchingCamera.value || countdownActive.value) return

  if (deviceId === cameraStore.activeDeviceId) {
    closeCameraPicker()
    return
  }

  const generation = setupGeneration
  isSwitchingCamera.value = true
  cameraError.value = null

  stopCamera(stream)
  stream = null
  liveCamAvailable.value = false
  if (videoRef.value) videoRef.value.srcObject = null

  try {
    const selected = cameraDevices.value.find((device) => device.deviceId === deviceId)
    const facingHint =
      selected?.facingMode === 'user' || selected?.facingMode === 'environment'
        ? selected.facingMode
        : undefined
    const nextStream = await switchCamera(deviceId, facingHint)
    if (generation !== setupGeneration) {
      stopCamera(nextStream)
      return
    }
    stream = nextStream
    liveCamAvailable.value = isLiveCamRecordingSupported(stream)
    await nextTick()
    await attachPreviewStream(generation)
    await refreshCameraDevices()
    closeCameraPicker()
  } catch (error) {
    console.error('Failed to switch camera:', error)
    if (generation === setupGeneration) {
      // setupCamera starts a new generation, so release this operation's busy flag first.
      isSwitchingCamera.value = false
      await setupCamera()
      cameraError.value = 'Kamera itu belum bisa dibuka. Coba pilih kamera lain.'
    }
  } finally {
    if (generation === setupGeneration) isSwitchingCamera.value = false
  }
}

function startLiveCamClip() {
  const isBgActive = backgroundProcessor.value?.isActive()
  const recordStream = isBgActive ? backgroundProcessor.value?.stream : stream
  if (!recordStream || !isLiveCamRecordingSupported(recordStream)) {
    liveCamAvailable.value = false
    return
  }

  try {
    activeLiveCamRecording = startLiveCamRecording(recordStream, {
      mirrored: isBgActive ? false : shouldMirrorActiveCamera.value,
    })
    liveCamRecordingActive.value = Boolean(activeLiveCamRecording)
  } catch (error) {
    console.warn('Live Cam recording could not start:', error)
    activeLiveCamRecording = null
    liveCamRecordingActive.value = false
    liveCamAvailable.value = false
  }
}

async function stopActiveLiveCamRecording(delayMs = 0): Promise<LiveCamClip | null> {
  const recording = activeLiveCamRecording
  activeLiveCamRecording = null
  liveCamRecordingActive.value = false

  if (!recording) return null

  try {
    return await recording.stop(delayMs)
  } catch (error) {
    console.warn('Live Cam recording could not stop:', error)
    return null
  }
}

async function handleCapture(liveClip: LiveCamClip | null = null, preCaptured?: CapturedFrame) {
  if (!videoRef.value || !stream) return
  const captureGeneration = setupGeneration
  let frame: CapturedFrame

  try {
    if (preCaptured) {
      frame = preCaptured
    } else if (backgroundProcessor.value?.isActive()) {
      frame = await backgroundProcessor.value.captureStill({
        mirrored: shouldMirrorActiveCamera.value,
      })
    } else {
      frame = await captureFrame(videoRef.value, {
        mirrored: shouldMirrorActiveCamera.value,
        processCanvas: processCapturedBackground,
      })
    }
  } catch (error) {
    console.error('Capture failed:', error)
    cameraError.value = 'Preview kamera belum siap. Coba ambil foto lagi.'
    return
  }

  if (captureGeneration !== setupGeneration) return

  const sessionId = sessionStore.sessionId
  if (!sessionId) return

  const order = sessionStore.currentShotIndex
  const capturedCameraEffectId = getCaptureCameraEffectId()

  let shots: Awaited<ReturnType<typeof getSessionShots>>

  try {
    const shotId = await saveShot({
      sessionId,
      order,
      sourceType: 'camera',
      blob: frame.blob,
      width: frame.width,
      height: frame.height,
      faceBounds: isFaceTrackingEffect(capturedCameraEffectId)
        ? latestOverlayFaces.value.map((face) => ({ ...face }))
        : [],
      cameraEffectId: capturedCameraEffectId,
      cameraEffectFrameMs: latestOverlayFrameMs.value,
      liveClip,
    })

    sessionStore.setShotIdAt(order, shotId)
    persistRetakeIndex(null)
    shots = await getSessionShots(sessionId)
  } catch (error) {
    console.error('Failed to save captured photo:', error)
    cameraError.value = isStorageQuotaError(error)
      ? getStorageErrorMessage(error)
      : 'Gagal menyimpan foto lokal. Coba ambil foto lagi.'
    return
  }

  if (isSessionComplete(shots, sessionStore.slotCount)) {
    sessionStore.setReviewing()
    if (stream) {
      stopCamera(stream)
      stream = null
      liveCamAvailable.value = false
    }
    router.push('/review')
    return
  }

  const nextMissingOrder = Array.from({ length: sessionStore.slotCount }, (_, index) => index).find(
    (index) => !shots.some((shot) => shot.order === index),
  )

  if (nextMissingOrder !== undefined) {
    sessionStore.currentShotIndex = nextMissingOrder
  } else {
    sessionStore.advanceShot()
  }

  // Trigger auto-capture for next shot
  if (sessionStore.autoCapture && autoCaptureRunning) {
    autoCaptureTimeout = setTimeout(() => {
      runCountdownAndCapture()
    }, 800)
  }
}

function triggerFlash() {
  flashVisible.value = true
  window.setTimeout(() => {
    flashVisible.value = false
  }, 220)
}

function cancelCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }

  if (autoCaptureTimeout) {
    clearTimeout(autoCaptureTimeout)
    autoCaptureTimeout = null
  }

  autoCaptureRunning = false
  countdownActive.value = false
  void stopActiveLiveCamRecording()
}

function runCountdownAndCapture() {
  if (
    !cameraReady.value ||
    !stream ||
    !sessionStore.sessionId ||
    countdownActive.value ||
    isCapturing.value ||
    isSwitchingCamera.value ||
    sessionSettingsOpen.value ||
    isApplyingSessionSettings.value
  ) {
    return
  }

  cameraError.value = null
  countdownValue.value = Math.max(1, sessionStore.countdownSeconds)
  countdownActive.value = true
  startLiveCamClip()

  // Mark auto-capture as running on the first manual trigger
  if (sessionStore.autoCapture) {
    autoCaptureRunning = true
  }

  countdownTimer = setInterval(async () => {
    countdownValue.value -= 1

    if (countdownValue.value <= 0) {
      if (countdownTimer) {
        clearInterval(countdownTimer)
        countdownTimer = null
      }

      countdownActive.value = false
      isCapturing.value = true
      triggerFlash()
      const captureGeneration = setupGeneration
      try {
        let frame: CapturedFrame | undefined
        try {
          if (videoRef.value) {
            if (backgroundProcessor.value?.isActive()) {
              frame = await backgroundProcessor.value.captureStill({
                mirrored: shouldMirrorActiveCamera.value,
              })
            } else {
              frame = await captureFrame(videoRef.value, {
                mirrored: shouldMirrorActiveCamera.value,
                processCanvas: processCapturedBackground,
              })
            }
          }
        } catch (error) {
          console.error('Capture failed:', error)
          cameraError.value = 'Preview kamera belum siap. Coba ambil foto lagi.'
          return
        }

        const liveClip = await stopActiveLiveCamRecording(450)
        if (captureGeneration !== setupGeneration || !frame) return
        await handleCapture(liveClip, frame)
      } finally {
        isCapturing.value = false
      }
    }
  }, 1000)
}

async function goBack() {
  if (autoCaptureTimeout) {
    clearTimeout(autoCaptureTimeout)
    autoCaptureTimeout = null
  }
  autoCaptureRunning = false
  cancelCountdown()
  void stopActiveLiveCamRecording()

  const sessionId = sessionStore.sessionId
  if (sessionId) {
    const snapshot = await getSessionSnapshot(sessionId)
    if (snapshot && isSessionComplete(snapshot.shots, snapshot.session.slotCount)) {
      persistRetakeIndex(null)
      sessionStore.setReviewing()
      router.push('/review')
      return
    }
  }

  await abandonIncompleteSession(sessionId)
  sessionStore.reset()

  router.push({ path: '/config', query: { source: 'camera' } })
}

function goToUploadFallback() {
  writePendingSessionConfig({
    layoutId: sessionStore.layoutId,
    templateId: sessionStore.templateId,
    slotCount: sessionStore.slotCount,
    countdownSeconds: sessionStore.countdownSeconds,
    autoCapture: sessionStore.autoCapture,
    source: 'upload',
  })
  router.push('/upload')
}
</script>

<template>
  <div
    v-if="cameraStore.permissionState === 'granted'"
    :class="[ui.page, 'min-h-dvh lg:h-dvh lg:overflow-hidden']"
  >
    <div :class="ui.headerWide">
      <div :class="ui.headerGroup">
        <button
          :class="ui.iconButton"
          aria-label="Kembali ke setup sesi"
          :disabled="countdownActive || isCapturing || isApplyingSessionSettings"
          @click="goBack"
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
          <h3 :class="ui.title">{{ shotProgressLabel }}</h3>
        </div>
      </div>
      <div class="flex items-center gap-2 sm:gap-3">
        <span :class="ui.badge">{{ sessionStore.countdownSeconds }}s</span>
        <span v-if="sessionStore.autoCapture" :class="ui.pinkBadge">Otomatis</span>
        <button
          :class="ui.iconButton"
          aria-label="Ubah setup sesi"
          :disabled="capturedCount > 0 || sessionSettingsDisabled || isApplyingSessionSettings"
          @click="openSessionSettings"
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
              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
            />
          </svg>
        </button>
      </div>
    </div>

    <main class="mx-auto flex min-h-0 w-full flex-1 p-4 lg:p-6">
      <CaptureWorkspace panel-label="Pengaturan foto Solo">
        <template #preview>
          <div
            class="camera-preview border-stc-border relative mx-auto aspect-[4/3] w-full overflow-hidden rounded-lg border bg-black"
          >
            <video
              ref="videoRef"
              autoplay
              playsinline
              muted
              :class="[
                'absolute inset-0 h-full w-full object-cover',
                shouldMirrorActiveCamera ? 'scale-x-[-1]' : '',
                virtualBackgroundPreviewActive ? 'opacity-0' : '',
              ]"
              :style="virtualBackgroundPreviewActive ? undefined : videoFilterStyle"
            ></video>
            <VirtualBackgroundCanvas
              :processor="backgroundProcessor"
              :video-el="videoRef"
              :background-id="sessionStore.virtualBackgroundId"
              :custom-image="customBackgroundFrame"
              :mirrored="shouldMirrorActiveCamera"
              class="pointer-events-none absolute inset-0 z-[4] h-full w-full"
              :style="virtualBackgroundPreviewActive ? videoFilterStyle : undefined"
              @active="virtualBackgroundPreviewActive = $event"
              @error="backgroundError = $event"
            />

            <div
              v-if="liveCamRecordingActive"
              data-testid="live-cam-recording"
              class="absolute top-3 left-3 z-20 inline-flex items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 text-xs font-semibold text-white"
            >
              <span
                class="bg-stc-pink inline-flex size-2 animate-pulse rounded-full"
                aria-hidden="true"
              ></span>
              Rec
            </div>

            <CameraEffectCanvas
              v-if="selectedCameraEffect.id !== 'none' && !isCurrentEffectFaceTracking"
              :effect-id="sessionStore.cameraEffectId"
              animated
              class="pointer-events-none absolute inset-0 z-[5] h-full w-full"
              @frame="updateOverlayFrame"
            />

            <FaceTrackingOverlay
              v-if="isCurrentEffectFaceTracking"
              :video-el="videoRef"
              :effect-id="sessionStore.cameraEffectId"
              :mirrored="shouldMirrorActiveCamera"
              class="pointer-events-none absolute inset-0 z-[5] h-full w-full"
              @update:faces="updateOverlayFaces"
              @update:frame-ms="updateOverlayFrame"
            />

            <div
              v-if="flashVisible"
              class="absolute inset-0 z-20 bg-white/90 transition-opacity duration-100"
            ></div>

            <div
              v-if="countdownActive"
              class="bg-stc-text/60 absolute inset-0 z-30 flex flex-col items-center justify-center text-center text-white transition-all"
              data-testid="camera-countdown"
            >
              <div
                class="text-6xl leading-none font-semibold tabular-nums drop-shadow-2xl sm:text-7xl"
              >
                {{ countdownValue }}
              </div>
              <button
                class="mt-8 rounded-full border border-white/30 bg-white/10 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/20 active:scale-95"
                @click="cancelCountdown"
              >
                Batal
              </button>
            </div>
          </div>
        </template>

        <template #actions>
          <div class="flex flex-col items-center gap-3">
            <div class="flex items-center justify-center gap-6">
              <button
                class="camera-shutter group border-stc-border hover:border-stc-text relative inline-flex size-[72px] items-center justify-center rounded-full border-[4px] bg-white disabled:pointer-events-none disabled:opacity-60 sm:size-20"
                aria-label="Ambil foto"
                :disabled="
                  !cameraReady ||
                  countdownActive ||
                  isCapturing ||
                  isSwitchingCamera ||
                  sessionSettingsOpen ||
                  isApplyingSessionSettings
                "
                @click="runCountdownAndCapture"
              >
                <span
                  class="bg-stc-pink inline-flex size-[52px] rounded-full shadow-inner transition-transform duration-200 group-hover:scale-95 group-active:scale-90 sm:size-[56px]"
                ></span>
              </button>

              <button
                :class="[ui.iconButton, 'rounded-full']"
                :aria-label="`Ganti kamera. Aktif: ${activeCameraLabel}`"
                :disabled="!canSwitchCamera"
                @click="handleSwitchCamera"
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M17 2.1l4 4-4 4" />
                  <path d="M3 12.2v-2a4 4 0 0 1 4-4h12.8M7 21.9l-4-4 4-4" />
                  <path d="M21 11.8v2a4 4 0 0 1-4 4H4.2" />
                </svg>
              </button>
            </div>

            <div
              v-if="isSwitchingCamera"
              class="text-stc-text-soft max-w-full text-center text-xs font-medium"
            >
              Mengganti kamera...
            </div>

            <div class="flex items-center justify-center gap-1.5">
              <span
                v-for="index in sessionStore.slotCount"
                :key="index"
                :class="[
                  'size-2 rounded-full',
                  sessionStore.shotIds[index - 1]
                    ? 'bg-stc-pink'
                    : index - 1 === sessionStore.currentShotIndex
                      ? 'bg-stc-text'
                      : 'bg-stc-bg-3',
                ]"
              />
            </div>

            <div v-if="cameraError" :class="[ui.alertError, 'mx-auto max-w-sm text-center']">
              {{ cameraError }}
            </div>

            <div v-if="backgroundError" :class="[ui.alertError, 'mx-auto max-w-sm text-center']">
              <p>{{ backgroundError }}</p>
              <div class="mt-2 flex items-center justify-center gap-2">
                <button
                  type="button"
                  :class="ui.secondaryButton"
                  class="!px-2.5 !py-1 !text-xs"
                  @click="retryVirtualBackground"
                >
                  Coba lagi
                </button>
                <button
                  type="button"
                  :class="ui.secondaryButton"
                  class="!px-2.5 !py-1 !text-xs"
                  @click="fallbackToOriginalBackground"
                >
                  Gunakan latar asli
                </button>
              </div>
            </div>
          </div>
        </template>

        <template #settings>
          <CaptureSessionSettings
            v-model:open="sessionSettingsOpen"
            :model-value="captureSessionConfig"
            :disabled="sessionSettingsDisabled"
            :busy="isApplyingSessionSettings"
            :captured-count="capturedCount"
            mode="solo"
            @apply="applySessionSettings"
            @restart="restartSessionPhotos"
          />
          <h2 class="text-stc-text mb-4 text-sm font-semibold">Tampilan foto</h2>
          <BoothDecorationPicker
            class="w-full"
            kind="all"
            stacked
            :filter-id="sessionStore.filterId"
            :camera-effect-id="sessionStore.cameraEffectId"
            :virtual-background-id="sessionStore.virtualBackgroundId"
            :disabled="!canChangeFilter"
            @select-filter="selectFilter"
            @select-effect="selectCameraEffect"
            @select-background="selectVirtualBackground"
            @custom-file="handleCustomBackground"
          />
        </template>
      </CaptureWorkspace>
    </main>

    <div
      v-if="cameraPickerOpen"
      class="fixed inset-0 z-[70] flex items-end justify-center bg-black/35 px-4 py-5 sm:items-center"
      role="dialog"
      aria-modal="true"
      @click.self="closeCameraPicker"
    >
      <div
        class="border-stc-border max-h-[min(36rem,calc(100dvh-2.5rem))] w-full max-w-lg overflow-hidden rounded-lg border bg-white"
      >
        <div
          class="border-stc-border flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5"
        >
          <div class="min-w-0">
            <p :class="ui.sectionLabel">Pilih Kamera</p>
            <p class="text-stc-text mt-1 truncate text-sm font-semibold">{{ activeCameraLabel }}</p>
          </div>
          <button
            :class="ui.iconButton"
            type="button"
            aria-label="Tutup pilihan kamera"
            @click="closeCameraPicker"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div class="max-h-[calc(100dvh-9rem)] space-y-2 overflow-y-auto p-4">
          <button
            v-for="device in cameraDevices"
            :key="device.deviceId"
            type="button"
            :aria-label="`Pilih kamera ${device.label}`"
            :aria-pressed="device.deviceId === cameraStore.activeDeviceId"
            :disabled="isSwitchingCamera"
            :class="[
              'focus-visible:ring-stc-pink/40 flex min-h-12 w-full min-w-0 items-center justify-between gap-3 rounded-md border px-3 py-2 text-left outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50',
              device.deviceId === cameraStore.activeDeviceId
                ? 'border-stc-text bg-stc-bg-2 text-stc-text'
                : 'border-stc-border text-stc-text hover:bg-stc-bg-2 bg-white',
            ]"
            @click="selectCameraDevice(device.deviceId)"
          >
            <span class="min-w-0">
              <span class="block truncate text-sm font-semibold">{{ device.label }}</span>
              <span
                v-if="device.rawLabel && device.rawLabel !== device.label"
                class="text-stc-text-soft mt-0.5 block truncate text-xs font-semibold"
              >
                {{ device.rawLabel }}
              </span>
            </span>
            <span
              v-if="device.deviceId === cameraStore.activeDeviceId"
              class="bg-stc-pink inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-white"
            >
              Aktif
            </span>
          </button>
        </div>
      </div>
    </div>
  </div>

  <div v-else-if="cameraStore.permissionState === 'denied'" :class="ui.page">
    <div :class="ui.header">
      <div :class="ui.headerGroup">
        <button :class="ui.iconButton" aria-label="Kembali ke setup sesi" @click="goBack">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <div class="min-w-0">
          <h3 :class="ui.title">Ambil Foto</h3>
        </div>
      </div>
    </div>
    <div class="m-auto flex w-full max-w-md flex-col px-4 py-10">
      <div :class="[ui.panel, 'w-full p-5']">
        <h3 class="text-stc-text text-[15px] font-medium">Kamera Tidak Diizinkan</h3>
        <p class="text-stc-text-soft mt-1 text-[13px] leading-normal">
          Aplikasi membutuhkan akses kamera. Izinkan lewat pengaturan browser lalu coba lagi.
        </p>
        <ol class="text-stc-text-soft mt-4 list-decimal space-y-1.5 pl-4 text-[13px]">
          <li v-for="step in cameraRecoverySteps" :key="step">{{ step }}</li>
        </ol>
        <div class="mt-4 flex flex-wrap gap-2">
          <button :class="ui.primaryButton" @click="setupCamera">Coba Lagi</button>
          <button :class="ui.secondaryButton" @click="goToUploadFallback">Upload Foto Lokal</button>
        </div>
      </div>
    </div>
  </div>

  <div v-else-if="cameraStore.permissionState === 'unavailable'" :class="ui.page">
    <div :class="ui.header">
      <div :class="ui.headerGroup">
        <button :class="ui.iconButton" aria-label="Kembali ke setup sesi" @click="goBack">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <div class="min-w-0">
          <h3 :class="ui.title">Ambil Foto</h3>
        </div>
      </div>
    </div>
    <div class="m-auto flex w-full max-w-md flex-col px-4 py-10">
      <div :class="[ui.panel, 'w-full p-5']">
        <h3 class="text-stc-text text-[15px] font-medium">{{ unavailableTitle }}</h3>
        <p class="text-stc-text-soft mt-1 text-[13px] leading-normal">
          {{ unavailableCopy }}
        </p>
        <div class="mt-4 flex flex-wrap gap-2">
          <button :class="ui.primaryButton" @click="setupCamera">Coba Lagi</button>
          <button :class="ui.secondaryButton" @click="goToUploadFallback">Upload Foto Lokal</button>
        </div>
      </div>
    </div>
  </div>

  <div v-else :class="ui.page">
    <div :class="ui.header">
      <div class="min-w-0">
        <h3 :class="ui.title">Ambil Foto</h3>
      </div>
    </div>

    <div class="m-auto flex w-full max-w-sm flex-col px-4 py-10">
      <div :class="[ui.panel, 'w-full p-5 text-center']">
        <div
          class="border-stc-border border-t-stc-pink mx-auto mb-3 size-6 animate-spin rounded-full border-2"
        ></div>
        <h3 class="text-stc-text text-[15px] font-medium">Menyiapkan kamera</h3>
      </div>
    </div>
  </div>
</template>
