<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  abandonIncompleteSession,
  createDefaultDecorationConfig,
  ensureSession,
  getSessionShots,
  getSessionSnapshot,
  isSessionComplete,
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
import { getLayoutById } from '@/layouts'
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
import {
  CAMERA_EFFECTS,
  getCameraEffectById,
  isFaceTrackingEffect,
} from '@/services/camera-effects'
import {
  isLiveCamRecordingSupported,
  startLiveCamRecording,
  type LiveCamClip,
  type LiveCamRecording,
} from '@/services/live-cam'
import type { FaceBounds } from '@/services/face-tracking'
import { getStorageErrorMessage, isStorageQuotaError } from '@/services/storage'
import { PHOTO_FILTERS, getPhotoFilterById } from '@/services/filter'
import { ui } from '@/ui/styles'
import CameraEffectCanvas from '@/components/common/CameraEffectCanvas.vue'
import FaceTrackingOverlay from '@/components/common/FaceTrackingOverlay.vue'
import FlowProgress from '@/components/common/FlowProgress.vue'

const router = useRouter()
const cameraStore = useCameraStore()
const sessionStore = useSessionStore()
const customTemplateStore = useCustomTemplateStore()

const videoRef = ref<HTMLVideoElement | null>(null)
const countdownActive = ref(false)
const countdownValue = ref(0)
const flashVisible = ref(false)
const cameraError = ref<string | null>(null)
const liveCamAvailable = ref(false)
const liveCamRecordingActive = ref(false)
const latestOverlayFaces = ref<FaceBounds[]>([])
const latestOverlayFrameMs = ref(0)
const cameraDevices = ref<CameraDeviceOption[]>([])
const cameraPickerOpen = ref(false)
const isSwitchingCamera = ref(false)
const isCapturing = ref(false)
const cameraReady = ref(false)
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
const activeLayout = computed(
  () =>
    customTemplateStore.getLayoutById(sessionStore.layoutId) ??
    getLayoutById(sessionStore.layoutId),
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
const filterOptions = PHOTO_FILTERS
const cameraEffectOptions = CAMERA_EFFECTS
const FILTER_INLINE_LIMIT = 4
const CAMERA_EFFECT_INLINE_LIMIT = 5
const selectedFilter = computed(() => getPhotoFilterById(sessionStore.filterId))
const selectedCameraEffect = computed(() => getCameraEffectById(sessionStore.cameraEffectId))
const activeOptionPicker = ref<'filter' | 'overlay' | null>(null)
const videoFilterStyle = computed(() => ({ filter: selectedFilter.value.cssFilter }))
const canChangeFilter = computed(
  () =>
    !countdownActive.value &&
    !isCapturing.value &&
    sessionStore.currentShotIndex === 0 &&
    !sessionStore.shotIds.some(Boolean),
)
const isCurrentEffectFaceTracking = computed(() =>
  isFaceTrackingEffect(sessionStore.cameraEffectId),
)
const inlineFilterOptions = computed(() =>
  getInlineOptions(filterOptions, FILTER_INLINE_LIMIT, sessionStore.filterId),
)
const hiddenFilterOptions = computed(() =>
  getHiddenOptions(filterOptions, inlineFilterOptions.value),
)
const inlineCameraEffectOptions = computed(() =>
  getInlineOptions(cameraEffectOptions, CAMERA_EFFECT_INLINE_LIMIT, sessionStore.cameraEffectId),
)
const hiddenCameraEffectOptions = computed(() =>
  getHiddenOptions(cameraEffectOptions, inlineCameraEffectOptions.value),
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
    !isCapturing.value,
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

watch(videoRef, () => {
  void attachPreviewStream()
})

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
  void setupCamera()
})

function getInlineOptions<T extends { id: string }>(
  options: T[],
  limit: number,
  selectedId: string,
): T[] {
  if (options.length <= limit) return options

  const initialOptions = options.slice(0, limit)
  if (initialOptions.some((option) => option.id === selectedId)) return initialOptions

  const selectedOption = options.find((option) => option.id === selectedId)
  if (!selectedOption) return initialOptions

  return [...options.slice(0, limit - 1), selectedOption]
}

function getHiddenOptions<T extends { id: string }>(options: T[], visibleOptions: T[]): T[] {
  const visibleIds = new Set(visibleOptions.map((option) => option.id))
  return options.filter((option) => !visibleIds.has(option.id))
}

function openOptionPicker(kind: 'filter' | 'overlay') {
  activeOptionPicker.value = kind
}

function closeOptionPicker() {
  activeOptionPicker.value = null
}

function handleGlobalKeydown(event: Event) {
  if (!('key' in event)) return

  if (event.key === 'Escape') {
    closeOptionPicker()
    closeCameraPicker()
    cancelCountdown()
    return
  }

  if (
    event.key === ' ' &&
    cameraStore.permissionState === 'granted' &&
    !activeOptionPicker.value &&
    !cameraPickerOpen.value
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

    const nextStream = await initCamera()
    if (generation !== setupGeneration) {
      stopCamera(nextStream)
      return
    }

    stream = nextStream
    liveCamAvailable.value = isLiveCamRecordingSupported(stream)
    await nextTick()
    await attachPreviewStream(generation)
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

async function selectFilterFromPicker(filterId: string) {
  await selectFilter(filterId)
  closeOptionPicker()
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

async function selectCameraEffectFromPicker(effectId: string) {
  await selectCameraEffect(effectId)
  closeOptionPicker()
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

function filterSwatchStyle(filterId: string) {
  const filter = getPhotoFilterById(filterId)

  return {
    background: filter.previewBackground,
    filter: filter.cssFilter,
  }
}

function cameraEffectSwatchStyle(effectId: string) {
  const effect = getCameraEffectById(effectId)

  return {
    background: effect.thumbnail ? 'transparent' : effect.previewBackground,
  }
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
      await setupCamera()
      cameraError.value = 'Kamera itu belum bisa dibuka. Coba pilih kamera lain.'
    }
  } finally {
    if (generation === setupGeneration) isSwitchingCamera.value = false
  }
}

function startLiveCamClip() {
  if (!stream || !isLiveCamRecordingSupported(stream)) {
    liveCamAvailable.value = false
    return
  }

  try {
    activeLiveCamRecording = startLiveCamRecording(stream, {
      mirrored: shouldMirrorActiveCamera.value,
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
    frame =
      preCaptured ??
      (await captureFrame(videoRef.value, { mirrored: shouldMirrorActiveCamera.value }))
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
    isSwitchingCamera.value
  ) {
    return
  }

  cameraError.value = null
  countdownValue.value = Math.max(1, sessionStore.countdownSeconds)
  countdownActive.value = true

  if (countdownValue.value <= 3) {
    startLiveCamClip()
  }

  // Mark auto-capture as running on the first manual trigger
  if (sessionStore.autoCapture) {
    autoCaptureRunning = true
  }

  countdownTimer = setInterval(async () => {
    countdownValue.value -= 1

    if (countdownValue.value === 3 && !liveCamRecordingActive.value) {
      startLiveCamClip()
    }

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
            frame = await captureFrame(videoRef.value, {
              mirrored: shouldMirrorActiveCamera.value,
            })
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
    :class="[ui.page, 'lg:h-dvh lg:overflow-hidden']"
  >
    <div :class="ui.headerWide">
      <div :class="ui.headerGroup">
        <button
          :class="ui.iconButton"
          aria-label="Kembali ke setup sesi"
          :disabled="countdownActive || isCapturing"
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
          <h3 :class="ui.title">Ambil Foto</h3>
          <p :class="ui.subtitle">
            {{ shotProgressLabel }} dengan timer {{ sessionStore.countdownSeconds }} detik{{
              sessionStore.autoCapture ? ' (Otomatis)' : ''
            }}.
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2 sm:gap-3">
        <span :class="ui.badge">
          {{ activeLayout?.printFormat.paperSize ?? `${sessionStore.slotCount} Foto` }}
        </span>
        <button
          :class="ui.iconButton"
          aria-label="Ubah setup sesi"
          :disabled="countdownActive || isCapturing"
          @click="router.push({ path: '/config', query: { source: 'camera' } })"
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

    <FlowProgress current="capture" source="camera" />

    <div :class="[ui.content, 'min-h-0 !pb-4']">
      <div
        :class="[
          ui.pageContentWide,
          'min-h-0 gap-4 lg:grid lg:grid-cols-[minmax(11.5rem,12.5rem)_minmax(0,1fr)_minmax(11.5rem,12.5rem)] lg:items-start lg:gap-5 xl:grid-cols-[13rem_minmax(0,1fr)_13rem]',
        ]"
      >
        <div
          class="border-stc-border order-2 w-full rounded-lg border bg-white p-3 lg:order-1 lg:max-h-[calc(100dvh-11rem)] lg:min-h-0 lg:self-start lg:overflow-y-auto"
        >
          <p :class="[ui.sectionLabel, 'mb-2']">Efek Kamera</p>
          <div
            class="flex gap-2 overflow-x-auto pb-1 lg:grid lg:grid-cols-1 lg:overflow-visible lg:pb-0"
          >
            <button
              v-for="filter in inlineFilterOptions"
              :key="filter.id"
              type="button"
              :aria-label="`Pilih efek ${filter.label}`"
              :aria-pressed="filter.id === sessionStore.filterId"
              :disabled="!canChangeFilter && filter.id !== sessionStore.filterId"
              :class="[
                'focus-visible:ring-stc-pink/40 flex h-14 w-14 shrink-0 flex-col items-center justify-center gap-1 rounded-md border px-1.5 text-[11px] font-medium outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-45 lg:w-full',
                filter.id === sessionStore.filterId
                  ? 'border-stc-text bg-stc-bg-2 text-stc-text'
                  : 'border-stc-border text-stc-text-soft hover:bg-stc-bg-2 hover:text-stc-text bg-white',
              ]"
              @click="selectFilter(filter.id)"
            >
              <span
                class="border-stc-border/50 block size-8 rounded-xl border shadow-inner"
                :style="filterSwatchStyle(filter.id)"
              ></span>
              <span class="max-w-full truncate">{{ filter.label }}</span>
            </button>
            <button
              v-if="hiddenFilterOptions.length > 0"
              type="button"
              class="border-stc-border text-stc-text-soft hover:bg-stc-bg-2 hover:text-stc-text focus-visible:ring-stc-pink/40 flex h-14 w-14 shrink-0 flex-col items-center justify-center gap-1 rounded-md border bg-white px-1.5 text-[11px] font-medium outline-none focus-visible:ring-2 lg:w-full"
              aria-label="Buka semua efek kamera"
              @click="openOptionPicker('filter')"
            >
              <span
                class="border-stc-border/60 bg-stc-bg-2 text-stc-pink flex size-8 items-center justify-center rounded-xl border text-base font-semibold"
                aria-hidden="true"
              >
                +
              </span>
              <span>Lainnya</span>
            </button>
          </div>
        </div>

        <div class="order-1 flex min-h-0 w-full flex-col items-center gap-4 lg:order-2">
          <div
            class="camera-preview border-stc-border relative mx-auto aspect-[4/3] w-full max-w-5xl shrink-0 overflow-hidden rounded-lg border bg-black"
          >
            <video
              ref="videoRef"
              autoplay
              playsinline
              muted
              :class="[
                'absolute inset-0 h-full w-full object-cover',
                shouldMirrorActiveCamera ? 'scale-x-[-1]' : '',
              ]"
              :style="videoFilterStyle"
            ></video>

            <div
              v-if="liveCamAvailable"
              class="absolute top-3 left-3 z-20 inline-flex items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 text-xs font-semibold text-white shadow-sm backdrop-blur-sm sm:top-4 sm:left-4"
            >
              <span
                class="bg-stc-pink inline-flex size-2 rounded-full"
                :class="{ 'animate-pulse': liveCamRecordingActive }"
                aria-hidden="true"
              ></span>
              {{ liveCamRecordingActive ? 'Live Cam merekam' : 'Live Cam siap' }}
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

            <!-- Viewfinder corners -->
            <div class="pointer-events-none absolute inset-5 z-10 hidden sm:block">
              <div
                class="border-stc-pink/70 absolute top-0 left-0 size-8 rounded-tl-xl border-t-4 border-l-4"
              ></div>
              <div
                class="border-stc-pink/70 absolute top-0 right-0 size-8 rounded-tr-xl border-t-4 border-r-4"
              ></div>
              <div
                class="border-stc-pink/70 absolute bottom-0 left-0 size-8 rounded-bl-xl border-b-4 border-l-4"
              ></div>
              <div
                class="border-stc-pink/70 absolute right-0 bottom-0 size-8 rounded-br-xl border-r-4 border-b-4"
              ></div>
            </div>

            <div
              v-if="countdownActive"
              class="bg-stc-text/60 absolute inset-0 z-30 flex flex-col items-center justify-center text-center text-white transition-all"
            >
              <div class="text-6xl leading-none font-semibold drop-shadow-2xl sm:text-7xl">
                {{ countdownValue }}
              </div>
              <div class="mt-4 rounded-full bg-black/35 px-5 py-2 text-sm font-semibold">
                Foto ke-{{ sessionStore.currentShotIndex + 1 }} dari
                {{ sessionStore.slotCount }}
              </div>
              <button
                class="mt-8 rounded-full border border-white/30 bg-white/10 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/20 active:scale-95"
                @click="cancelCountdown"
              >
                Batal
              </button>
            </div>
          </div>

          <div class="flex flex-col items-center gap-3">
            <div class="flex items-center justify-center gap-6">
            <button
              :class="[ui.iconButton, 'rounded-full']"
              aria-label="Kembali ke setup sesi"
              @click="goBack"
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
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>

            <button
              class="camera-shutter group border-stc-border hover:border-stc-text relative inline-flex size-[72px] items-center justify-center rounded-full border-[4px] bg-white disabled:pointer-events-none disabled:opacity-60 sm:size-20"
              aria-label="Ambil foto"
              :disabled="!cameraReady || countdownActive || isCapturing"
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
            v-if="cameraDevices.length > 1"
            class="text-stc-text-soft max-w-full text-center text-xs font-medium"
          >
            <span class="truncate">
              {{ isSwitchingCamera ? 'Mengganti kamera...' : activeCameraLabel }}
            </span>
          </div>

          <div class="flex flex-wrap items-center justify-center gap-2">
            <div
              v-for="index in sessionStore.slotCount"
              :key="index"
              :class="[
                'flex h-8 w-8 items-center justify-center rounded-md border text-[11px] font-medium',
                index - 1 === sessionStore.currentShotIndex
                  ? 'border-stc-text bg-stc-text text-white'
                  : sessionStore.shotIds[index - 1]
                    ? 'border-stc-success/30 bg-stc-success-soft text-stc-success'
                    : 'border-stc-border text-stc-text-faint bg-white',
              ]"
            >
              {{
                index - 1 === sessionStore.currentShotIndex
                  ? `${index}/${sessionStore.slotCount}`
                  : index
              }}
            </div>
          </div>

          <div v-if="cameraError" :class="[ui.alertError, 'mx-auto max-w-sm text-center']">
            {{ cameraError }}
          </div>
          </div>
        </div>

        <div
          class="border-stc-border order-3 w-full rounded-lg border bg-white p-3 lg:max-h-[calc(100dvh-11rem)] lg:min-h-0 lg:self-start lg:overflow-y-auto"
        >
          <p :class="[ui.sectionLabel, 'mb-2']">Overlay Kamera</p>
          <div
            class="flex gap-2 overflow-x-auto pb-1 lg:grid lg:grid-cols-1 lg:overflow-visible lg:pb-0"
          >
            <button
              v-for="effect in inlineCameraEffectOptions"
              :key="effect.id"
              type="button"
              :aria-label="`Pilih overlay ${effect.label}`"
              :aria-pressed="effect.id === sessionStore.cameraEffectId"
              :disabled="!canChangeFilter && effect.id !== sessionStore.cameraEffectId"
              :title="effect.description"
              :class="[
                'focus-visible:ring-stc-pink/40 flex h-14 w-14 shrink-0 flex-col items-center justify-center gap-1 rounded-md border px-1.5 text-[11px] font-medium outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-45 lg:w-full',
                effect.id === sessionStore.cameraEffectId
                  ? 'border-stc-text bg-stc-bg-2 text-stc-text'
                  : 'border-stc-border text-stc-text-soft hover:bg-stc-bg-2 hover:text-stc-text bg-white',
              ]"
              @click="selectCameraEffect(effect.id)"
            >
              <span
                class="border-stc-border/50 relative block size-8 overflow-hidden rounded-xl border shadow-inner"
                :style="cameraEffectSwatchStyle(effect.id)"
              >
                <img
                  v-if="effect.thumbnail"
                  :src="effect.thumbnail"
                  alt=""
                  class="h-full w-full object-contain p-1"
                />
              </span>
              <span class="max-w-full truncate">{{ effect.label }}</span>
            </button>
            <button
              v-if="hiddenCameraEffectOptions.length > 0"
              type="button"
              class="border-stc-border text-stc-text-soft hover:bg-stc-bg-2 hover:text-stc-text focus-visible:ring-stc-pink/40 flex h-14 w-14 shrink-0 flex-col items-center justify-center gap-1 rounded-md border bg-white px-1.5 text-[11px] font-medium outline-none focus-visible:ring-2 lg:w-full"
              aria-label="Buka semua overlay kamera"
              @click="openOptionPicker('overlay')"
            >
              <span
                class="border-stc-border/60 bg-stc-bg-2 text-stc-pink flex size-8 items-center justify-center rounded-xl border text-base font-semibold"
                aria-hidden="true"
              >
                +
              </span>
              <span>Lainnya</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="activeOptionPicker"
      class="fixed inset-0 z-[70] flex items-end justify-center bg-black/35 px-4 py-5 sm:items-center"
      role="dialog"
      aria-modal="true"
      @click.self="closeOptionPicker"
    >
      <div
        class="border-stc-border max-h-[min(42rem,calc(100dvh-2.5rem))] w-full max-w-2xl overflow-hidden rounded-lg border bg-white"
      >
        <div
          class="border-stc-border flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5"
        >
          <div class="min-w-0">
            <p :class="ui.sectionLabel">
              {{ activeOptionPicker === 'filter' ? 'Efek Kamera' : 'Overlay Kamera' }}
            </p>
          </div>
          <button
            :class="ui.iconButton"
            type="button"
            aria-label="Tutup"
            @click="closeOptionPicker"
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

        <div class="max-h-[calc(100dvh-9rem)] overflow-y-auto p-4">
          <div v-if="activeOptionPicker === 'filter'" class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              v-for="filter in filterOptions"
              :key="filter.id"
              type="button"
              :aria-label="`Pilih efek ${filter.label}`"
              :aria-pressed="filter.id === sessionStore.filterId"
              :disabled="!canChangeFilter && filter.id !== sessionStore.filterId"
              :class="[
                'focus-visible:ring-stc-pink/40 flex min-h-12 min-w-0 flex-row items-center justify-start gap-3 rounded-md border px-3 py-2 text-[13px] font-medium outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-45',
                filter.id === sessionStore.filterId
                  ? 'border-stc-text bg-stc-bg-2 text-stc-text'
                  : 'border-stc-border text-stc-text-soft hover:bg-stc-bg-2 hover:text-stc-text bg-white',
              ]"
              @click="selectFilterFromPicker(filter.id)"
            >
              <span
                class="border-stc-border/50 block size-10 shrink-0 rounded-xl border shadow-inner"
                :style="filterSwatchStyle(filter.id)"
              ></span>
              <span class="max-w-full truncate">{{ filter.label }}</span>
            </button>
          </div>

          <div v-else class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              v-for="effect in cameraEffectOptions"
              :key="effect.id"
              type="button"
              :aria-label="`Pilih overlay ${effect.label}`"
              :aria-pressed="effect.id === sessionStore.cameraEffectId"
              :disabled="!canChangeFilter && effect.id !== sessionStore.cameraEffectId"
              :title="effect.description"
              :class="[
                'focus-visible:ring-stc-pink/40 flex min-h-12 min-w-0 flex-row items-center justify-start gap-3 rounded-md border px-3 py-2 text-[13px] font-medium outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-45',
                effect.id === sessionStore.cameraEffectId
                  ? 'border-stc-text bg-stc-bg-2 text-stc-text'
                  : 'border-stc-border text-stc-text-soft hover:bg-stc-bg-2 hover:text-stc-text bg-white',
              ]"
              @click="selectCameraEffectFromPicker(effect.id)"
            >
              <span
                class="border-stc-border/50 relative block size-10 shrink-0 overflow-hidden rounded-xl border shadow-inner"
                :style="cameraEffectSwatchStyle(effect.id)"
              >
                <img
                  v-if="effect.thumbnail"
                  :src="effect.thumbnail"
                  alt=""
                  class="h-full w-full object-contain p-1"
                />
              </span>
              <span class="max-w-full truncate">{{ effect.label }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

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
          <p :class="ui.subtitle">Izinkan kamera untuk lanjut.</p>
        </div>
      </div>
    </div>
    <FlowProgress current="capture" source="camera" />

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
          <p :class="ui.subtitle">Kamera belum bisa dibuka.</p>
        </div>
      </div>
    </div>
    <FlowProgress current="capture" source="camera" />

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
        <p :class="ui.subtitle">Memuat preview perangkat.</p>
      </div>
    </div>
    <FlowProgress current="capture" source="camera" />

    <div class="m-auto flex w-full max-w-sm flex-col px-4 py-10">
      <div :class="[ui.panel, 'w-full p-5 text-center']">
        <div
          class="border-stc-border border-t-stc-pink mx-auto mb-3 size-6 animate-spin rounded-full border-2"
        ></div>
        <h3 class="text-stc-text text-[15px] font-medium">Menyiapkan Kamera...</h3>
        <p class="text-stc-text-soft mt-1 text-[13px]">Memuat preview perangkat.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.camera-preview {
  max-width: min(1040px, calc((100dvh - 20rem) * 4 / 3));
  max-height: calc(100dvh - 20rem);
}

@media (max-width: 767px) {
  .camera-preview {
    max-width: 1040px;
    max-height: none;
  }
}

@media (max-height: 720px) and (min-width: 768px) {
  .camera-preview {
    max-width: min(900px, calc((100dvh - 16rem) * 4 / 3));
    max-height: calc(100dvh - 16rem);
  }
}
</style>
