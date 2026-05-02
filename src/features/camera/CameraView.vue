<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  createDecorationConfig,
  ensureSession,
  getSessionShots,
  saveShot,
} from '@/services/session'
import { FILTERS, getFilterById } from '@/services/decoration'
import { getTemplateById } from '@/templates'
import { getLayoutById } from '@/layouts'
import { useCameraStore, useCustomizeStore, useSessionStore } from '@/stores'
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
const customizeStore = useCustomizeStore()
const sessionStore = useSessionStore()

const videoRef = ref<HTMLVideoElement | null>(null)
const countdownActive = ref(false)
const countdownValue = ref(0)
const flashVisible = ref(false)
const cameraError = ref<string | null>(null)
let stream: MediaStream | null = null
let countdownTimer: ReturnType<typeof setInterval> | null = null

const templateName = computed(() => getTemplateById(sessionStore.templateId)?.name ?? 'Classic')
const activeLayout = computed(() => getLayoutById(sessionStore.layoutId))
const quickFilters = FILTERS.slice(0, 5)
const activePreviewFilter = computed(
  () => getFilterById(customizeStore.activeFilterId)?.cssFilter ?? 'none',
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
      decoration: createDecorationConfig({
        filterId: customizeStore.activeFilterId,
        frameColor: customizeStore.frameColor,
        selectedStickerIds: customizeStore.selectedStickerIds,
        showDateTime: customizeStore.showDateTime,
        logoText: customizeStore.logoText,
      }),
    })

    if (!sessionStore.sessionId) {
      sessionStore.startSession(sessionId, 'camera', sessionStore.slotCount)
      sessionStore.sessionStatus = 'capturing'
    }
  } catch (error) {
    console.error('Camera init failed:', error)
    if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError')) {
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
  let blob: Blob

  try {
    blob = await captureFrame(videoRef.value)
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
    blob,
    width: videoRef.value.videoWidth,
    height: videoRef.value.videoHeight,
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
    class="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 pb-8 pt-12 sm:px-6 lg:px-10"
  >
    <div class="mb-4 flex items-center justify-between gap-4">
      <button :class="ui.iconButton" @click="goBack">
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
        <span :class="ui.badge">{{ templateName }}</span>
      </div>
      <button :class="ui.iconButton" @click="router.push('/config')">
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

    <div class="relative flex-1 overflow-hidden rounded-[34px] border-2 border-stc-border bg-stc-bg-3 shadow-[0_24px_70px_rgba(26,26,46,0.12)]">
      <video
        ref="videoRef"
        autoplay
        playsinline
        muted
        class="absolute inset-0 h-full w-full object-cover"
        :style="{ filter: activePreviewFilter }"
      ></video>

      <div
        v-if="flashVisible"
        class="absolute inset-0 bg-white/85"
      ></div>

      <div class="absolute left-4 top-4 size-7 rounded-tl-lg border-l-[3px] border-t-[3px] border-stc-pink"></div>
      <div class="absolute right-4 top-4 size-7 rounded-tr-lg border-r-[3px] border-t-[3px] border-stc-pink"></div>
      <div class="absolute bottom-4 left-4 size-7 rounded-bl-lg border-b-[3px] border-l-[3px] border-stc-pink"></div>
      <div class="absolute bottom-4 right-4 size-7 rounded-br-lg border-b-[3px] border-r-[3px] border-stc-pink"></div>

      <div
        v-if="countdownActive"
        class="absolute inset-0 flex flex-col items-center justify-center bg-[rgba(26,26,46,0.28)] text-center text-white backdrop-blur-sm"
      >
        <div class="text-[7rem] font-black leading-none sm:text-[8rem]">{{ countdownValue }}</div>
        <div class="mt-3 text-sm font-semibold">
          Foto ke-{{ sessionStore.currentShotIndex + 1 }} dari {{ sessionStore.slotCount }}
        </div>
        <button class="mt-6 text-sm font-medium text-white/90 underline underline-offset-4" @click="cancelCountdown">
          Batal
        </button>
      </div>
    </div>

    <div class="pt-5">
      <div class="mb-4 flex flex-wrap items-center justify-center gap-2">
        <div
          v-for="index in sessionStore.slotCount"
          :key="index"
          :class="[
            'flex h-16 w-12 items-center justify-center rounded-xl border text-[10px] font-semibold shadow-stc-sm transition-all duration-200',
            index - 1 === sessionStore.currentShotIndex
              ? 'border-stc-pink bg-stc-pink-soft text-stc-pink'
              : sessionStore.shotIds[index - 1]
                ? 'border-stc-success/30 bg-stc-success-soft text-stc-success'
                : 'border-stc-border bg-white text-stc-text-faint',
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
        class="mb-4 rounded-2xl border border-stc-error/20 bg-stc-error-soft px-4 py-3 text-center text-sm font-semibold text-stc-error"
      >
        {{ cameraError }}
      </div>

      <div class="mb-4 flex snap-x items-center justify-start gap-2 overflow-x-auto pb-1">
        <button
          v-for="filter in quickFilters"
          :key="filter.id"
          :class="[
            'shrink-0 rounded-full border px-4 py-2 text-xs font-semibold shadow-stc-sm transition-all duration-200 hover:-translate-y-0.5',
            customizeStore.activeFilterId === filter.id
              ? 'border-stc-pink bg-stc-pink-soft text-stc-pink'
              : 'border-stc-border bg-white text-stc-text-faint hover:bg-stc-bg-2',
          ]"
          @click="customizeStore.setFilter(filter.id)"
        >
          {{ filter.name }}
        </button>
      </div>

      <div class="flex items-center justify-center gap-6">
        <button :class="ui.iconButton" @click="goBack">&#8635;</button>
        <button
          class="relative inline-flex size-[88px] items-center justify-center rounded-full border-4 border-stc-pink bg-white shadow-[0_18px_40px_rgba(244,91,141,0.28)] transition-all duration-200 hover:scale-[1.03] active:scale-95"
          @click="runCountdownAndCapture"
        >
          <span class="inline-flex size-[66px] rounded-full bg-stc-pink"></span>
        </button>
        <button :class="ui.iconButton" @click="handleSwitchCamera">&#9889;</button>
      </div>
    </div>
  </div>

  <div
    v-else-if="cameraStore.permissionState === 'denied'"
    class="mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center justify-center px-4 py-10 text-center sm:px-6"
  >
    <div :class="[ui.panel, 'w-full max-w-xl px-8 py-10']">
      <div class="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-stc-error-soft text-stc-error">
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
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      </div>
      <h3 class="text-xl font-bold tracking-tight text-stc-text">Kamera Tidak Diizinkan</h3>
      <p class="mt-3 text-sm leading-relaxed text-stc-text-soft">
        Aplikasi membutuhkan akses kamera. Izinkan lewat pengaturan browser lalu coba lagi.
      </p>
      <div class="mt-6 space-y-3 text-left text-sm text-stc-text-soft">
        <div v-for="(step, index) in cameraRecoverySteps" :key="step" class="flex items-start gap-3">
          <span class="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-stc-border bg-stc-bg-2 text-xs font-bold text-stc-text-faint">
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
      <div class="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-stc-warning-soft text-stc-warning">
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
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M9.5 9.5L14.5 14.5" />
        </svg>
      </div>
      <h3 class="text-xl font-bold tracking-tight text-stc-text">Tidak Ada Kamera</h3>
      <p class="mt-3 text-sm leading-relaxed text-stc-text-soft">
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
      <div class="mx-auto mb-5 size-12 animate-spin rounded-full border-4 border-transparent border-r-stc-pink/60 border-t-stc-pink"></div>
      <h3 class="text-xl font-bold tracking-tight text-stc-text">Menyiapkan Kamera...</h3>
      <p class="mt-3 text-sm leading-relaxed text-stc-text-soft">Memuat preview perangkat.</p>
    </div>
  </div>
</template>
