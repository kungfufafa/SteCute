<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  createDefaultDecorationConfig,
  ensureSession,
  getSessionShots,
  saveShot,
  updateSessionDecorationConfig,
} from '@/services/session'
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
} from '@/services/camera'
import {
  CAMERA_EFFECTS,
  getCameraEffectById,
  isFaceTrackingEffect,
} from '@/services/camera-effects'
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
const latestOverlayFaces = ref<FaceBounds[]>([])
const latestOverlayFrameMs = ref(0)
const cameraDevices = ref<CameraDeviceOption[]>([])
const cameraPickerOpen = ref(false)
const isSwitchingCamera = ref(false)
let stream: MediaStream | null = null
let countdownTimer: ReturnType<typeof setInterval> | null = null
let autoCaptureTimeout: ReturnType<typeof setTimeout> | null = null
let autoCaptureRunning = false

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
  () => cameraDevices.value.length > 1 && !countdownActive.value && !isSwitchingCamera.value,
)

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
  if ('key' in event && event.key === 'Escape') {
    closeOptionPicker()
    closeCameraPicker()
  }
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

async function setupCamera() {
  sessionStore.setCapturing()
  cameraStore.setPermissionState('prompt')
  cameraStore.setStreamReady(false)
  cameraError.value = null

  if (stream) {
    stopCamera(stream)
    stream = null
  }

  try {
    stream = await initCamera()
    if (videoRef.value) videoRef.value.srcObject = stream
    await refreshCameraDevices()

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

    if (!sessionStore.sessionId) {
      sessionStore.startSession(sessionId, 'camera', sessionStore.slotCount)
      sessionStore.sessionStatus = 'capturing'
    }

    await persistCameraDecoration(sessionId)
  } catch (error) {
    const errorName = error instanceof DOMException ? error.name : ''
    const isDeniedError = errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError'
    const isUnavailableError = [
      'NotFoundError',
      'DevicesNotFoundError',
      'NotReadableError',
      'TrackStartError',
      'AbortError',
      'OverconstrainedError',
    ].includes(errorName)

    if (isDeniedError) {
      cameraStore.setPermissionState('denied')
    } else if (isUnavailableError) {
      cameraStore.setPermissionState('unavailable')
    } else {
      console.error('Camera init failed:', error)
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

  isSwitchingCamera.value = true
  cameraError.value = null

  stopCamera(stream)
  stream = null
  if (videoRef.value) videoRef.value.srcObject = null

  try {
    stream = await switchCamera(deviceId)
    if (videoRef.value) videoRef.value.srcObject = stream
    await refreshCameraDevices()
    closeCameraPicker()
  } catch (error) {
    console.error('Failed to switch camera:', error)
    await setupCamera()
    cameraError.value = 'Kamera itu belum bisa dibuka. Coba pilih kamera lain.'
  } finally {
    isSwitchingCamera.value = false
  }
}

async function handleCapture() {
  if (!videoRef.value || !stream) return
  let frame: Awaited<ReturnType<typeof captureFrame>>

  try {
    frame = await captureFrame(videoRef.value, { mirrored: shouldMirrorActiveCamera.value })
  } catch (error) {
    console.error('Capture failed:', error)
    cameraError.value = 'Preview kamera belum siap. Coba ambil foto lagi.'
    return
  }

  const sessionId = sessionStore.sessionId
  if (!sessionId) return

  const order = sessionStore.currentShotIndex
  const capturedCameraEffectId = getCaptureCameraEffectId()
  const hadShotAtOrder = !!(await getSessionShots(sessionId)).find((shot) => shot.order === order)

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
    })

    if (hadShotAtOrder) {
      sessionStore.replaceShotId(order, shotId)
    } else {
      sessionStore.addShotId(shotId)
    }

    shots = await getSessionShots(sessionId)
  } catch (error) {
    console.error('Failed to save captured photo:', error)
    cameraError.value = isStorageQuotaError(error)
      ? getStorageErrorMessage(error)
      : 'Gagal menyimpan foto lokal. Coba ambil foto lagi.'
    return
  }

  if (shots.length >= sessionStore.slotCount) {
    sessionStore.setReviewing()
    if (stream) {
      stopCamera(stream)
      stream = null
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
}

function runCountdownAndCapture() {
  if (countdownActive.value) return

  cameraError.value = null
  countdownValue.value = Math.max(1, sessionStore.countdownSeconds)
  countdownActive.value = true

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
      triggerFlash()
      await handleCapture()
    }
  }, 1000)
}

function goBack() {
  // Cancel any running auto-capture
  if (autoCaptureTimeout) {
    clearTimeout(autoCaptureTimeout)
    autoCaptureTimeout = null
  }
  autoCaptureRunning = false
  cancelCountdown()

  // Reset session so user starts fresh from config
  sessionStore.reset()

  router.push({ path: '/config', query: { source: 'camera' } })
}
</script>

<template>
  <div
    v-if="cameraStore.permissionState === 'granted'"
    :class="[ui.page, 'lg:h-dvh lg:overflow-hidden']"
  >
    <div :class="[ui.headerWide, '!pt-4 !pb-3 sm:!pt-5 lg:!pt-6']">
      <div :class="ui.headerGroup">
        <button :class="ui.iconButton" aria-label="Kembali ke setup sesi" @click="goBack">
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
        <span :class="ui.pinkBadge">
          {{ activeLayout?.printFormat.paperSize ?? `${sessionStore.slotCount} Foto` }}
        </span>
        <button
          :class="ui.iconButton"
          aria-label="Ubah setup sesi"
          @click="router.push({ path: '/config', query: { source: 'camera' } })"
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
            <circle cx="12" cy="12" r="3" />
            <path
              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
            />
          </svg>
        </button>
      </div>
    </div>

    <FlowProgress current="capture" source="camera" />

    <div :class="[ui.content, 'flex min-h-0 flex-col !pb-0']">
      <div
        :class="[
          ui.pageContentWide,
          'min-h-0 gap-4 lg:grid lg:grid-cols-[minmax(11.5rem,12.5rem)_minmax(0,1fr)_minmax(11.5rem,12.5rem)] lg:items-start lg:gap-5 xl:grid-cols-[13rem_minmax(0,1fr)_13rem]',
        ]"
      >
        <div
          class="border-stc-border shadow-stc-xs order-2 w-full rounded-xl border bg-white/95 px-3 py-3 sm:px-4 lg:order-1 lg:max-h-[calc(100dvh-11rem)] lg:min-h-0 lg:self-start lg:overflow-y-auto"
        >
          <p :class="[ui.sectionLabel, 'mb-2 px-1']">Efek Kamera</p>
          <div
            class="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:grid lg:grid-cols-1 lg:overflow-visible lg:px-0 lg:pb-0"
          >
            <button
              v-for="filter in inlineFilterOptions"
              :key="filter.id"
              type="button"
              :aria-label="`Pilih efek ${filter.label}`"
              :aria-pressed="filter.id === sessionStore.filterId"
              :disabled="!canChangeFilter && filter.id !== sessionStore.filterId"
              :class="[
                'focus-visible:ring-stc-pink flex h-[4.75rem] w-[4.75rem] shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border px-2 text-[0.6875rem] font-bold transition-all duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45 lg:w-full',
                filter.id === sessionStore.filterId
                  ? 'border-stc-pink bg-stc-pink-soft text-stc-pink shadow-stc-sm'
                  : 'border-stc-border text-stc-text-soft shadow-stc-xs hover:border-stc-pink/40 hover:text-stc-text bg-white hover:-translate-y-[1px]',
              ]"
              @click="selectFilter(filter.id)"
            >
              <span
                class="border-stc-border/50 block size-8 rounded-lg border shadow-inner"
                :style="filterSwatchStyle(filter.id)"
              ></span>
              <span class="max-w-full truncate">{{ filter.label }}</span>
            </button>
            <button
              v-if="hiddenFilterOptions.length > 0"
              type="button"
              class="border-stc-border text-stc-text-soft shadow-stc-xs hover:border-stc-pink/40 hover:text-stc-text focus-visible:ring-stc-pink flex h-[4.75rem] w-[4.75rem] shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border bg-white px-2 text-[0.6875rem] font-bold transition-all duration-200 hover:-translate-y-[1px] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none lg:w-full"
              aria-label="Buka semua efek kamera"
              @click="openOptionPicker('filter')"
            >
              <span
                class="border-stc-border/60 bg-stc-bg-2 text-stc-pink flex size-8 items-center justify-center rounded-lg border text-base font-bold"
                aria-hidden="true"
              >
                +
              </span>
              <span>More</span>
            </button>
          </div>
        </div>

        <div class="order-1 flex min-h-0 w-full flex-col items-center gap-4 lg:order-2">
          <div
            class="camera-preview border-stc-border shadow-stc-md relative mx-auto aspect-[4/3] w-full max-w-5xl shrink-0 overflow-hidden rounded-xl border bg-black/95"
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
              <div class="text-[5rem] leading-none font-bold drop-shadow-2xl sm:text-[7rem]">
                {{ countdownValue }}
              </div>
              <div class="mt-4 rounded-full bg-black/35 px-5 py-2 text-sm font-bold">
                Foto ke-{{ sessionStore.currentShotIndex + 1 }} dari
                {{ sessionStore.slotCount }}
              </div>
              <button
                class="mt-8 rounded-full border border-white/30 bg-white/10 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white/20 active:scale-95"
                @click="cancelCountdown"
              >
                Batal
              </button>
            </div>
          </div>

          <div class="flex items-center justify-center gap-8">
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
              class="camera-shutter group border-stc-border shadow-stc-md hover:border-stc-pink/40 active:border-stc-pink relative inline-flex size-[72px] items-center justify-center rounded-full border-[5px] bg-white transition-all duration-200 hover:scale-105 active:scale-95 sm:size-20"
              aria-label="Ambil foto"
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
            class="text-stc-text-soft -mt-1 max-w-full text-center text-xs font-bold"
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
                'shadow-stc-xs flex h-12 w-10 items-center justify-center rounded-xl border text-[10px] font-bold transition-all duration-300 sm:h-14 sm:w-11 sm:text-xs',
                index - 1 === sessionStore.currentShotIndex
                  ? 'border-stc-pink bg-stc-pink-soft text-stc-pink shadow-stc-sm z-10 scale-110'
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

          <div
            v-if="cameraError"
            class="border-stc-error/30 bg-stc-error-soft text-stc-error shadow-stc-xs mx-auto max-w-sm rounded-xl border px-4 py-3 text-center text-sm font-semibold"
          >
            {{ cameraError }}
          </div>
        </div>

        <div
          class="border-stc-border shadow-stc-xs order-3 w-full rounded-xl border bg-white/95 px-3 py-3 sm:px-4 lg:max-h-[calc(100dvh-11rem)] lg:min-h-0 lg:self-start lg:overflow-y-auto"
        >
          <p :class="[ui.sectionLabel, 'mb-2 px-1']">Overlay Kamera</p>
          <div
            class="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:grid lg:grid-cols-1 lg:overflow-visible lg:px-0 lg:pb-0"
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
                'focus-visible:ring-stc-pink flex h-[4.75rem] w-[4.75rem] shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border px-2 text-[0.6875rem] font-bold transition-all duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45 lg:w-full',
                effect.id === sessionStore.cameraEffectId
                  ? 'border-stc-pink bg-stc-pink-soft text-stc-pink shadow-stc-sm'
                  : 'border-stc-border text-stc-text-soft shadow-stc-xs hover:border-stc-pink/40 hover:text-stc-text bg-white hover:-translate-y-[1px]',
              ]"
              @click="selectCameraEffect(effect.id)"
            >
              <span
                class="border-stc-border/50 relative block size-8 overflow-hidden rounded-lg border shadow-inner"
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
              class="border-stc-border text-stc-text-soft shadow-stc-xs hover:border-stc-pink/40 hover:text-stc-text focus-visible:ring-stc-pink flex h-[4.75rem] w-[4.75rem] shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border bg-white px-2 text-[0.6875rem] font-bold transition-all duration-200 hover:-translate-y-[1px] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none lg:w-full"
              aria-label="Buka semua overlay kamera"
              @click="openOptionPicker('overlay')"
            >
              <span
                class="border-stc-border/60 bg-stc-bg-2 text-stc-pink flex size-8 items-center justify-center rounded-lg border text-base font-bold"
                aria-hidden="true"
              >
                +
              </span>
              <span>More</span>
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
        class="border-stc-border shadow-stc-lg max-h-[min(42rem,calc(100dvh-2.5rem))] w-full max-w-2xl overflow-hidden rounded-xl border bg-white"
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

        <div class="max-h-[calc(100dvh-9rem)] overflow-y-auto p-4 sm:p-5">
          <div v-if="activeOptionPicker === 'filter'" class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              v-for="filter in filterOptions"
              :key="filter.id"
              type="button"
              :aria-label="`Pilih efek ${filter.label}`"
              :aria-pressed="filter.id === sessionStore.filterId"
              :disabled="!canChangeFilter && filter.id !== sessionStore.filterId"
              :class="[
                'focus-visible:ring-stc-pink flex min-h-[5.25rem] min-w-0 flex-row items-center justify-start gap-4 rounded-xl border px-4 py-2 text-[0.875rem] font-bold transition-all duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45',
                filter.id === sessionStore.filterId
                  ? 'border-stc-pink bg-stc-pink-soft text-stc-pink shadow-stc-sm'
                  : 'border-stc-border text-stc-text-soft shadow-stc-xs hover:border-stc-pink/40 hover:text-stc-text bg-white hover:-translate-y-[1px]',
              ]"
              @click="selectFilterFromPicker(filter.id)"
            >
              <span
                class="border-stc-border/50 block size-10 shrink-0 rounded-lg border shadow-inner"
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
                'focus-visible:ring-stc-pink flex min-h-[5.25rem] min-w-0 flex-row items-center justify-start gap-4 rounded-xl border px-4 py-2 text-[0.875rem] font-bold transition-all duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45',
                effect.id === sessionStore.cameraEffectId
                  ? 'border-stc-pink bg-stc-pink-soft text-stc-pink shadow-stc-sm'
                  : 'border-stc-border text-stc-text-soft shadow-stc-xs hover:border-stc-pink/40 hover:text-stc-text bg-white hover:-translate-y-[1px]',
              ]"
              @click="selectCameraEffectFromPicker(effect.id)"
            >
              <span
                class="border-stc-border/50 relative block size-10 shrink-0 overflow-hidden rounded-lg border shadow-inner"
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
        class="border-stc-border shadow-stc-lg max-h-[min(36rem,calc(100dvh-2.5rem))] w-full max-w-lg overflow-hidden rounded-xl border bg-white"
      >
        <div
          class="border-stc-border flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5"
        >
          <div class="min-w-0">
            <p :class="ui.sectionLabel">Pilih Kamera</p>
            <p class="text-stc-text mt-1 truncate text-sm font-bold">{{ activeCameraLabel }}</p>
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

        <div class="max-h-[calc(100dvh-9rem)] space-y-2 overflow-y-auto p-4 sm:p-5">
          <button
            v-for="device in cameraDevices"
            :key="device.deviceId"
            type="button"
            :aria-label="`Pilih kamera ${device.label}`"
            :aria-pressed="device.deviceId === cameraStore.activeDeviceId"
            :disabled="isSwitchingCamera"
            :class="[
              'focus-visible:ring-stc-pink flex min-h-[4.75rem] w-full min-w-0 items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition-all duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
              device.deviceId === cameraStore.activeDeviceId
                ? 'border-stc-pink bg-stc-pink-soft text-stc-pink shadow-stc-sm'
                : 'border-stc-border text-stc-text shadow-stc-xs hover:border-stc-pink/40 bg-white hover:-translate-y-[1px]',
            ]"
            @click="selectCameraDevice(device.deviceId)"
          >
            <span class="min-w-0">
              <span class="block truncate text-sm font-bold">{{ device.label }}</span>
              <span
                v-if="device.rawLabel && device.rawLabel !== device.label"
                class="text-stc-text-soft mt-0.5 block truncate text-xs font-semibold"
              >
                {{ device.rawLabel }}
              </span>
            </span>
            <span
              v-if="device.deviceId === cameraStore.activeDeviceId"
              class="bg-stc-pink inline-flex shrink-0 rounded-full px-2.5 py-1 text-[0.6875rem] font-bold text-white"
            >
              Aktif
            </span>
          </button>
        </div>
      </div>
    </div>
  </div>

  <div v-else-if="cameraStore.permissionState === 'denied'" :class="ui.page">
    <FlowProgress current="capture" source="camera" />

    <div class="m-auto flex w-full max-w-xl flex-col px-5 py-10">
      <div :class="[ui.panel, 'w-full px-6 py-10 sm:px-10']">
        <div :class="[ui.statusIcon, 'bg-stc-error-soft text-stc-error']">
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
            />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        </div>
        <h3 class="text-stc-text text-center text-xl font-bold">Kamera Tidak Diizinkan</h3>
        <p
          class="text-stc-text-soft mx-auto mt-3 max-w-sm text-center text-[0.9375rem] leading-relaxed font-medium"
        >
          Aplikasi membutuhkan akses kamera. Izinkan lewat pengaturan browser lalu coba lagi.
        </p>
        <div
          class="bg-stc-bg-2 text-stc-text-soft mt-8 space-y-3 rounded-xl p-5 text-sm font-medium"
        >
          <div
            v-for="(step, index) in cameraRecoverySteps"
            :key="step"
            class="flex items-center gap-3"
          >
            <span
              class="text-stc-text shadow-stc-xs flex size-7 shrink-0 items-center justify-center rounded-full bg-white font-bold"
            >
              {{ index + 1 }}
            </span>
            <span>{{ step }}</span>
          </div>
        </div>
        <div class="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button :class="ui.primaryButton" @click="setupCamera">Coba Lagi</button>
          <button :class="ui.secondaryButton" @click="router.push('/upload')">
            Upload Foto Lokal
          </button>
        </div>
      </div>
    </div>
  </div>

  <div v-else-if="cameraStore.permissionState === 'unavailable'" :class="ui.page">
    <FlowProgress current="capture" source="camera" />

    <div class="m-auto flex w-full max-w-xl flex-col px-5 py-10">
      <div :class="[ui.panel, 'w-full px-6 py-10 text-center sm:px-10']">
        <div
          class="bg-stc-warning-soft text-stc-warning shadow-stc-xs mx-auto mb-6 flex size-16 items-center justify-center rounded-xl"
        >
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
            />
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M9.5 9.5L14.5 14.5" />
          </svg>
        </div>
        <h3 class="text-stc-text text-xl font-bold">Tidak Ada Kamera</h3>
        <p
          class="text-stc-text-soft mx-auto mt-3 max-w-sm text-[0.9375rem] leading-relaxed font-medium"
        >
          Perangkat ini tidak memiliki kamera atau sedang dipakai aplikasi lain.
        </p>
        <div class="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button :class="ui.primaryButton" @click="router.push('/upload')">
            Upload Foto Lokal
          </button>
          <button :class="ui.secondaryButton" @click="router.push('/')">Kembali</button>
        </div>
      </div>
    </div>
  </div>

  <div v-else :class="ui.page">
    <FlowProgress current="capture" source="camera" />

    <div class="m-auto flex w-full max-w-md flex-col px-5 py-10">
      <div :class="[ui.panelSoft, 'w-full px-6 py-12 text-center']">
        <div
          class="border-r-stc-pink/20 border-t-stc-pink mx-auto mb-6 size-12 animate-spin rounded-full border-[4px] border-transparent"
        ></div>
        <h3 class="text-stc-text text-xl font-bold">Menyiapkan Kamera...</h3>
        <p class="text-stc-text-soft mt-2 text-sm font-medium">Memuat preview perangkat.</p>
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
