<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  createDefaultDecorationConfig,
  ensureSession,
  getSessionShots,
  saveShot,
} from '@/services/session'
import { getTemplateById } from '@/templates'
import { getLayoutById } from '@/layouts'
import { useCameraStore, useSessionStore } from '@/stores'
import {
  captureFrame,
  enumerateDevices,
  initCamera,
  stopCamera,
  switchCamera,
} from '@/services/camera'
import { ui } from '@/ui/styles'
import FlowProgress from '@/components/common/FlowProgress.vue'

const router = useRouter()
const cameraStore = useCameraStore()
const sessionStore = useSessionStore()

const videoRef = ref<HTMLVideoElement | null>(null)
const countdownActive = ref(false)
const countdownValue = ref(0)
const flashVisible = ref(false)
const cameraError = ref<string | null>(null)
let stream: MediaStream | null = null
let countdownTimer: ReturnType<typeof setInterval> | null = null
let autoCaptureTimeout: ReturnType<typeof setTimeout> | null = null
let autoCaptureRunning = false

const activeTemplate = computed(() => getTemplateById(sessionStore.templateId))
const activeLayout = computed(() => getLayoutById(sessionStore.layoutId))
const shotProgressLabel = computed(
  () => `Foto ${sessionStore.currentShotIndex + 1} dari ${sessionStore.slotCount}`,
)
const cameraRecoverySteps = [
  'Buka pengaturan browser',
  'Cari izin Kamera',
  'Ubah menjadi Izinkan',
  'Muat ulang halaman',
]

onMounted(() => {
  void setupCamera()
})

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

    const sessionId = await ensureSession(sessionStore.sessionId, {
      layoutId: sessionStore.layoutId,
      templateId: sessionStore.templateId,
      slotCount: sessionStore.slotCount,
      captureSource: 'camera',
      decoration: createDefaultDecorationConfig(activeTemplate.value),
    })

    if (!sessionStore.sessionId) {
      sessionStore.startSession(sessionId, 'camera', sessionStore.slotCount)
      sessionStore.sessionStatus = 'capturing'
    }
  } catch (error) {
    const isDeniedError =
      error instanceof DOMException &&
      (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError')
    const isUnavailableError = error instanceof DOMException && error.name === 'NotFoundError'

    if (isDeniedError) {
      cameraStore.setPermissionState('denied')
    } else if (isUnavailableError) {
      cameraStore.setPermissionState('unavailable')
    } else {
      console.error('Camera init failed:', error)
      cameraStore.setPermissionState('denied')
    }
  }
}

onUnmounted(() => {
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
  if (!stream) return
  const devices = await enumerateDevices()
  if (devices.length <= 1) return
  const currentIndex = devices.findIndex((device) => device.deviceId === cameraStore.activeDeviceId)
  const nextIndex = (currentIndex + 1) % devices.length
  stopCamera(stream)
  stream = await switchCamera(devices[nextIndex].deviceId)
  if (videoRef.value) videoRef.value.srcObject = stream
}

async function handleCapture() {
  if (!videoRef.value || !stream) return
  let frame: Awaited<ReturnType<typeof captureFrame>>

  try {
    frame = await captureFrame(videoRef.value)
  } catch (error) {
    console.error('Capture failed:', error)
    cameraError.value = 'Preview kamera belum siap. Coba ambil foto lagi.'
    return
  }

  const sessionId = sessionStore.sessionId
  if (!sessionId) return

  const order = sessionStore.currentShotIndex
  const hadShotAtOrder = !!(await getSessionShots(sessionId)).find((shot) => shot.order === order)

  const shotId = await saveShot({
    sessionId,
    order,
    sourceType: 'camera',
    blob: frame.blob,
    width: frame.width,
    height: frame.height,
  })

  if (hadShotAtOrder) {
    sessionStore.replaceShotId(order, shotId)
  } else {
    sessionStore.addShotId(shotId)
  }

  const shots = await getSessionShots(sessionId)

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
      <div :class="[ui.pageContentWide, 'min-h-0 justify-between']">
        <div
          class="camera-preview border-stc-border shadow-stc-md relative mx-auto aspect-[4/3] w-full max-w-4xl overflow-hidden rounded-xl border bg-black/95"
        >
          <video
            ref="videoRef"
            autoplay
            playsinline
            muted
            class="absolute inset-0 h-full w-full object-cover scale-x-[-1]"
          ></video>

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
              Foto ke-{{ sessionStore.currentShotIndex + 1 }} dari {{ sessionStore.slotCount }}
            </div>
            <button
              class="mt-8 rounded-full border border-white/30 bg-white/10 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white/20 active:scale-95"
              @click="cancelCountdown"
            >
              Batal
            </button>
          </div>
        </div>

        <div class="mt-auto flex w-full flex-col pt-5">
          <div class="mb-5 flex flex-wrap items-center justify-center gap-2">
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
            class="border-stc-error/30 bg-stc-error-soft text-stc-error shadow-stc-xs mx-auto mb-5 max-w-sm rounded-xl border px-4 py-3 text-center text-sm font-semibold"
          >
            {{ cameraError }}
          </div>

          <div class="flex items-center justify-center gap-8 pb-4">
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
              aria-label="Ganti kamera"
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
