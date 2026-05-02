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

const activeTemplate = computed(() => getTemplateById(sessionStore.templateId))
const activeLayout = computed(() => getLayoutById(sessionStore.layoutId))
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
    console.error('Camera init failed:', error)
    if (
      error instanceof DOMException &&
      (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError')
    ) {
      cameraStore.setPermissionState('denied')
    } else if (error instanceof DOMException && error.name === 'NotFoundError') {
      cameraStore.setPermissionState('unavailable')
    } else {
      cameraStore.setPermissionState('denied')
    }
  }
}

onUnmounted(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }

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

  countdownActive.value = false
}

function runCountdownAndCapture() {
  if (countdownActive.value) return

  cameraError.value = null
  countdownValue.value = Math.max(1, sessionStore.countdownSeconds)
  countdownActive.value = true

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
  router.push('/config')
}
</script>

<template>
  <div
    v-if="cameraStore.permissionState === 'granted'"
    class="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 py-5 sm:px-6 md:h-dvh md:overflow-hidden md:py-4 lg:px-10"
  >
    <div class="mb-3 flex items-center justify-between gap-4">
      <button :class="ui.iconButton" aria-label="Kembali ke setup sesi" @click="goBack">
        <svg
          width="18"
          height="18"
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
      <div class="flex flex-wrap items-center justify-center gap-2">
        <span :class="ui.badge">
          {{ activeLayout?.printFormat.paperSize ?? `${sessionStore.slotCount} Foto` }}
        </span>
      </div>
      <button :class="ui.iconButton" aria-label="Ubah setup sesi" @click="router.push('/config')">
        <svg
          width="18"
          height="18"
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

    <div
      class="camera-preview border-stc-border shadow-stc-sm relative mx-auto aspect-[4/3] w-full overflow-hidden rounded-xl border-2 bg-black"
    >
      <video
        ref="videoRef"
        autoplay
        playsinline
        muted
        class="absolute inset-0 h-full w-full object-cover"
      ></video>

      <div v-if="flashVisible" class="absolute inset-0 bg-white/85"></div>

      <div
        class="border-stc-pink absolute top-4 left-4 size-7 rounded-tl-lg border-t-2 border-l-2"
      ></div>
      <div
        class="border-stc-pink absolute top-4 right-4 size-7 rounded-tr-lg border-t-2 border-r-2"
      ></div>
      <div
        class="border-stc-pink absolute bottom-4 left-4 size-7 rounded-bl-lg border-b-2 border-l-2"
      ></div>
      <div
        class="border-stc-pink absolute right-4 bottom-4 size-7 rounded-br-lg border-r-2 border-b-2"
      ></div>

      <div
        v-if="countdownActive"
        class="bg-stc-text/25 absolute inset-0 flex flex-col items-center justify-center text-center text-white"
      >
        <div class="text-[7rem] leading-none font-bold sm:text-[8rem]">
          {{ countdownValue }}
        </div>
        <div class="mt-3 text-sm font-semibold">
          Foto ke-{{ sessionStore.currentShotIndex + 1 }} dari {{ sessionStore.slotCount }}
        </div>
        <button
          class="mt-6 text-sm font-medium text-white/90 underline underline-offset-4"
          @click="cancelCountdown"
        >
          Batal
        </button>
      </div>
    </div>

    <div class="pt-4">
      <div class="mb-3 flex flex-wrap items-center justify-center gap-2">
        <div
          v-for="index in sessionStore.slotCount"
          :key="index"
          :class="[
            'shadow-stc-xs flex h-12 w-10 items-center justify-center rounded-lg border text-[10px] font-semibold transition-colors duration-150 sm:h-14 sm:w-11',
            index - 1 === sessionStore.currentShotIndex
              ? 'border-stc-pink bg-stc-pink-soft text-stc-pink'
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
        class="border-stc-error/20 bg-stc-error-soft text-stc-error mb-4 rounded-xl border px-4 py-3 text-center text-sm font-semibold"
      >
        {{ cameraError }}
      </div>

      <div class="flex items-center justify-center gap-6">
        <button :class="ui.iconButton" aria-label="Kembali ke setup sesi" @click="goBack">
          &#8635;
        </button>
        <button
          class="camera-shutter border-stc-pink shadow-stc-sm hover:bg-stc-pink-soft relative inline-flex size-[76px] items-center justify-center rounded-full border-4 bg-white transition-colors duration-150 sm:size-20"
          aria-label="Ambil foto"
          @click="runCountdownAndCapture"
        >
          <span class="bg-stc-pink inline-flex size-14 rounded-full sm:size-[60px]"></span>
        </button>
        <button :class="ui.iconButton" aria-label="Ganti kamera" @click="handleSwitchCamera">
          &#9889;
        </button>
      </div>
    </div>
  </div>

  <div
    v-else-if="cameraStore.permissionState === 'denied'"
    class="mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center justify-center px-4 py-10 text-center sm:px-6"
  >
    <div :class="[ui.panel, 'w-full max-w-xl px-8 py-10']">
      <div
        class="bg-stc-error-soft text-stc-error mx-auto mb-5 flex size-16 items-center justify-center rounded-full"
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
          />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      </div>
      <h3 class="text-stc-text text-xl font-bold tracking-tight">Kamera Tidak Diizinkan</h3>
      <p class="text-stc-text-soft mt-3 text-sm leading-relaxed">
        Aplikasi membutuhkan akses kamera. Izinkan lewat pengaturan browser lalu coba lagi.
      </p>
      <div class="text-stc-text-soft mt-6 space-y-3 text-left text-sm">
        <div
          v-for="(step, index) in cameraRecoverySteps"
          :key="step"
          class="flex items-start gap-3"
        >
          <span
            class="border-stc-border bg-stc-bg-2 text-stc-text-faint inline-flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold"
          >
            {{ index + 1 }}
          </span>
          <span>{{ step }}</span>
        </div>
      </div>
      <div class="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button :class="[ui.primaryButton, 'w-full']" @click="setupCamera">Coba Lagi</button>
        <button :class="[ui.secondaryButton, 'w-full']" @click="router.push('/upload')">
          Upload Foto Lokal
        </button>
      </div>
    </div>
  </div>

  <div
    v-else-if="cameraStore.permissionState === 'unavailable'"
    class="mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center justify-center px-4 py-10 text-center sm:px-6"
  >
    <div :class="[ui.panel, 'w-full max-w-xl px-8 py-10']">
      <div
        class="bg-stc-warning-soft text-stc-warning mx-auto mb-5 flex size-16 items-center justify-center rounded-full"
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
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
      <h3 class="text-stc-text text-xl font-bold tracking-tight">Tidak Ada Kamera</h3>
      <p class="text-stc-text-soft mt-3 text-sm leading-relaxed">
        Perangkat ini tidak memiliki kamera atau sedang dipakai aplikasi lain.
      </p>
      <div class="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button :class="[ui.primaryButton, 'w-full']" @click="router.push('/upload')">
          Upload Foto Lokal
        </button>
        <button :class="[ui.secondaryButton, 'w-full']" @click="router.push('/')">Kembali</button>
      </div>
    </div>
  </div>

  <div
    v-else
    class="mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center justify-center px-4 py-10 text-center sm:px-6"
  >
    <div :class="[ui.panel, 'w-full max-w-md px-8 py-10']">
      <div
        class="border-r-stc-pink/60 border-t-stc-pink mx-auto mb-5 size-12 animate-spin rounded-full border-4 border-transparent"
      ></div>
      <h3 class="text-stc-text text-xl font-bold tracking-tight">Menyiapkan Kamera...</h3>
      <p class="text-stc-text-soft mt-3 text-sm leading-relaxed">Memuat preview perangkat.</p>
    </div>
  </div>
</template>

<style scoped>
.camera-preview {
  max-width: min(1040px, calc((100dvh - 15rem) * 4 / 3));
}

@media (max-width: 767px) {
  .camera-preview {
    max-width: 1040px;
  }
}

@media (max-height: 720px) and (min-width: 768px) {
  .camera-preview {
    max-width: min(900px, calc((100dvh - 13.75rem) * 4 / 3));
  }

  .camera-shutter {
    width: 4.25rem;
    height: 4.25rem;
  }
}
</style>
