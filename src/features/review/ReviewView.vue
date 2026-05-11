<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { Shot, SlotConfig } from '@/db/schema'
import { getReviewSessionSnapshot, resetSessionData, saveShot } from '@/services/session'
import {
  createAdjustedImageBlob,
  createAutoUploadImageAdjustment,
  clampUploadImageAdjustment,
  getAdjustedCropRect,
  getImageDimensions,
  openImagePicker,
  type UploadImageAdjustment,
  validateFile,
} from '@/services/upload'
import { getStorageErrorMessage, isStorageQuotaError } from '@/services/storage'
import { getTemplateById, resolveTemplateLayout } from '@/templates'
import { useCustomTemplateStore } from '@/app/store/useCustomTemplateStore'
import { useSessionStore } from '@/app/store/useSessionStore'
import { ui } from '@/ui/styles'
import { getLayoutById } from '@/layouts'
import StripCanvasPreview from '@/components/common/StripCanvasPreview.vue'
import FlowProgress from '@/components/common/FlowProgress.vue'

interface ReplacementUpload {
  file: File
  url: string
  width: number
  height: number
  index: number
  adjustment: UploadImageAdjustment
}

interface ReplacementDragState {
  pointerId: number
  startX: number
  startY: number
  startOffsetX: number
  startOffsetY: number
  width: number
  height: number
}

interface PhotoDragTarget {
  clientWidth: number
  clientHeight: number
  setPointerCapture: (pointerId: number) => void
  releasePointerCapture: (pointerId: number) => void
  hasPointerCapture: (pointerId: number) => boolean
}

const ZOOM_STEP = 0.14

const router = useRouter()
const sessionStore = useSessionStore()
const customTemplateStore = useCustomTemplateStore()
const fallbackSlot: SlotConfig = { x: 0, y: 0, width: 1080, height: 810, radius: 0 }
const activeLayout = computed(
  () =>
    customTemplateStore.getLayoutById(sessionStore.layoutId) ??
    getLayoutById(sessionStore.layoutId),
)
const activeTemplate = computed(
  () =>
    customTemplateStore.getTemplateById(sessionStore.templateId) ??
    getTemplateById(sessionStore.templateId),
)
const renderLayout = computed(() => {
  if (!activeLayout.value || !activeTemplate.value) return activeLayout.value
  return resolveTemplateLayout(activeLayout.value, activeTemplate.value)
})

const shotUrls = ref<string[]>([])
const loadedShots = ref<Shot[]>([])
const reviewError = ref<string | null>(null)
const isLoadingReview = ref(true)
const replacementUpload = ref<ReplacementUpload | null>(null)
const replacementDragState = ref<ReplacementDragState | null>(null)
const isSavingReplacement = ref(false)
const replacementSlot = computed(() =>
  replacementUpload.value ? getSlotForIndex(replacementUpload.value.index) : fallbackSlot,
)
const replacementCropAspectRatio = computed(
  () => `${replacementSlot.value.width} / ${replacementSlot.value.height}`,
)
const replacementLabel = computed(() =>
  replacementUpload.value ? `Foto ${replacementUpload.value.index + 1}` : 'Foto pengganti',
)
const replacementCropStyle = computed(() => {
  const item = replacementUpload.value
  if (!item) return {}

  if (item.adjustment.fit === 'contain') {
    return {
      backgroundColor: '#fff7fa',
      backgroundImage: `url("${item.url}")`,
      backgroundPosition: '50% 50%',
      backgroundSize: 'contain',
    }
  }

  const slot = replacementSlot.value
  const crop = getAdjustedCropRect(
    item.width,
    item.height,
    slot.width,
    slot.height,
    item.adjustment,
  )
  const maxSx = Math.max(0, item.width - crop.sw)
  const maxSy = Math.max(0, item.height - crop.sh)
  const positionX = maxSx === 0 ? 50 : (crop.sx / maxSx) * 100
  const positionY = maxSy === 0 ? 50 : (crop.sy / maxSy) * 100

  return {
    backgroundImage: `url("${item.url}")`,
    backgroundPosition: `${positionX}% ${positionY}%`,
    backgroundSize: `${(item.width / crop.sw) * 100}% ${(item.height / crop.sh) * 100}%`,
  }
})

function revokeShotUrls() {
  shotUrls.value.forEach((url) => URL.revokeObjectURL(url))
  shotUrls.value = []
}

function clearReplacementUpload() {
  if (replacementUpload.value) {
    URL.revokeObjectURL(replacementUpload.value.url)
  }

  replacementUpload.value = null
  replacementDragState.value = null
}

async function loadShotUrls() {
  const snapshot = await getReviewSessionSnapshot(sessionStore.sessionId)

  if (!snapshot) {
    revokeShotUrls()
    reviewError.value = 'Sesi review tidak ditemukan. Mulai sesi baru untuk membuat strip.'
    isLoadingReview.value = false
    return
  }

  sessionStore.restoreFromSession(snapshot.session, snapshot.shots)
  revokeShotUrls()
  loadedShots.value = snapshot.shots
  shotUrls.value = snapshot.shots.map((shot) => URL.createObjectURL(shot.blob))
  reviewError.value = null
  isLoadingReview.value = false
}

onMounted(async () => {
  await customTemplateStore.loadPersistedTemplates()
  await loadShotUrls()
})

onBeforeUnmount(() => {
  revokeShotUrls()
  clearReplacementUpload()
})

function getSlotForIndex(index: number): SlotConfig {
  return renderLayout.value?.slots[index] ?? activeLayout.value?.slots[index] ?? fallbackSlot
}

function createAutoAdjustment(
  width: number,
  height: number,
  slot: SlotConfig,
): UploadImageAdjustment {
  return createAutoUploadImageAdjustment(width, height, slot.width, slot.height)
}

function setReplacementAdjustment(adjustment: Partial<UploadImageAdjustment>) {
  const item = replacementUpload.value
  if (!item) return

  item.adjustment = clampUploadImageAdjustment({
    ...item.adjustment,
    ...adjustment,
  })
}

function resetReplacementAdjustment() {
  const item = replacementUpload.value
  if (!item) return

  item.adjustment = createAutoAdjustment(item.width, item.height, replacementSlot.value)
  replacementDragState.value = null
}

function adjustReplacementZoom(delta: number) {
  const item = replacementUpload.value
  if (!item) return

  setReplacementAdjustment({ fit: 'cover', zoom: item.adjustment.zoom + delta })
}

function zoomReplacementWheel(event: globalThis.WheelEvent) {
  event.preventDefault()
  adjustReplacementZoom(event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP)
}

function beginReplacementDrag(event: globalThis.PointerEvent) {
  if (isSavingReplacement.value || !replacementUpload.value) return

  const target = event.currentTarget as PhotoDragTarget | null
  if (!target) return

  target.setPointerCapture(event.pointerId)
  replacementDragState.value = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startOffsetX: replacementUpload.value.adjustment.offsetX,
    startOffsetY: replacementUpload.value.adjustment.offsetY,
    width: target.clientWidth,
    height: target.clientHeight,
  }
}

function moveReplacementDrag(event: globalThis.PointerEvent) {
  const state = replacementDragState.value
  const item = replacementUpload.value
  if (!state || !item || state.pointerId !== event.pointerId) return

  const zoomDamping = Math.max(1, item.adjustment.zoom)
  const deltaX = ((event.clientX - state.startX) / Math.max(1, state.width)) * 2
  const deltaY = ((event.clientY - state.startY) / Math.max(1, state.height)) * 2

  setReplacementAdjustment({
    fit: 'cover',
    offsetX: state.startOffsetX - deltaX / zoomDamping,
    offsetY: state.startOffsetY - deltaY / zoomDamping,
  })
}

function endReplacementDrag(event: globalThis.PointerEvent) {
  if (replacementDragState.value?.pointerId !== event.pointerId) return

  const target = event.currentTarget as PhotoDragTarget | null
  if (!target) return

  if (target.hasPointerCapture(event.pointerId)) {
    target.releasePointerCapture(event.pointerId)
  }

  replacementDragState.value = null
}

async function retakeAll() {
  const previousSource = sessionStore.captureSource ?? 'camera'
  if (sessionStore.sessionId) {
    await resetSessionData(sessionStore.sessionId)
  }
  sessionStore.reset()
  router.push({ path: '/config', query: { source: previousSource } })
}

async function prepareUploadReplacement(index: number) {
  const files = await openImagePicker(false)
  const file = files?.[0]

  if (!file) return

  const validation = validateFile(file)

  if (!validation.valid) {
    reviewError.value = validation.errors[0] ?? 'File tidak valid.'
    return
  }

  try {
    const dimensions = await getImageDimensions(file)
    const slot = getSlotForIndex(index)
    const nextReplacement: ReplacementUpload = {
      file,
      url: URL.createObjectURL(file),
      width: dimensions.width,
      height: dimensions.height,
      index,
      adjustment: createAutoAdjustment(dimensions.width, dimensions.height, slot),
    }

    clearReplacementUpload()
    replacementUpload.value = nextReplacement
    reviewError.value = null
  } catch (error) {
    console.error('Failed to prepare replacement photo:', error)
    reviewError.value = 'Foto pengganti gagal dibaca. Pilih file lain dan coba lagi.'
  }
}

async function saveUploadReplacement() {
  const replacement = replacementUpload.value
  const sessionId = sessionStore.sessionId

  if (!replacement || !sessionId) return

  isSavingReplacement.value = true
  reviewError.value = null

  try {
    const slot = getSlotForIndex(replacement.index)
    const adjusted = await createAdjustedImageBlob(replacement.file, {
      targetWidth: slot.width,
      targetHeight: slot.height,
      adjustment: replacement.adjustment,
    })

    await saveShot({
      sessionId,
      order: replacement.index,
      sourceType: 'upload',
      blob: adjusted.blob,
      width: adjusted.width,
      height: adjusted.height,
    })

    clearReplacementUpload()
    await loadShotUrls()
  } catch (error) {
    console.error('Failed to save retaken photo:', error)
    reviewError.value = isStorageQuotaError(error)
      ? getStorageErrorMessage(error)
      : 'Gagal menyimpan foto pengganti. Coba lagi.'
  } finally {
    isSavingReplacement.value = false
  }
}

async function retakeShot(index: number) {
  reviewError.value = null

  if (sessionStore.captureSource === 'upload') {
    await prepareUploadReplacement(index)
    return
  }

  sessionStore.currentShotIndex = index
  router.push('/camera')
}

function proceedToRender() {
  if (!sessionStore.sessionId || shotUrls.value.length < sessionStore.slotCount) {
    reviewError.value = 'Foto sesi belum lengkap. Muat ulang atau mulai sesi baru.'
    return
  }

  router.push('/render')
}
</script>

<template>
  <div :class="ui.page">
    <div :class="ui.header">
      <div class="min-w-0 flex-1 space-y-1">
        <h3 :class="ui.title">Preview</h3>
        <p :class="ui.subtitle">
          Ketuk slot foto jika ingin mengulang tangkapan sebelum hasil akhir.
        </p>
      </div>
      <span :class="ui.pinkBadge">
        {{ activeLayout?.printFormat.paperSize ?? `${sessionStore.slotCount} Foto` }}
      </span>
    </div>

    <FlowProgress current="review" :source="sessionStore.captureSource" />

    <div :class="[ui.content, 'flex flex-col']">
      <div :class="[ui.pageContent, 'items-center gap-8 text-center']">
        <div v-if="isLoadingReview" :class="ui.emptyPanel">
          <div :class="ui.surfaceIcon">
            <div
              class="border-r-stc-pink/30 border-t-stc-pink size-8 animate-spin rounded-full border-[3px] border-transparent"
            ></div>
          </div>
          <h4 class="text-stc-text text-xl font-bold">Memuat Review</h4>
          <p
            class="text-stc-text-soft mx-auto mt-3 max-w-sm text-[0.9375rem] leading-relaxed font-medium"
          >
            Mengambil ulang foto sesi dari penyimpanan lokal.
          </p>
        </div>

        <StripCanvasPreview
          v-else
          :layout="activeLayout"
          :template-config="activeTemplate"
          :shots="loadedShots"
          :shot-urls="shotUrls"
          :filter-id="sessionStore.filterId"
          :camera-effect-id="sessionStore.cameraEffectId"
          interactive
          fit-viewport
          @retake="retakeShot"
          class="transition-transform duration-300 hover:scale-[1.02]"
        />

        <div v-if="replacementUpload" :class="[ui.panel, 'w-full max-w-xl p-4 text-left sm:p-5']">
          <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p :class="ui.sectionLabel">Foto Pengganti</p>
              <h4 class="text-stc-text mt-1 text-lg font-bold">{{ replacementLabel }}</h4>
            </div>
            <span :class="ui.pinkBadge">Atur Framing</span>
          </div>

          <div
            class="border-stc-border bg-stc-bg-2 relative mx-auto w-full max-w-lg cursor-grab touch-none overflow-hidden rounded-xl border select-none active:cursor-grabbing"
            :style="{ aspectRatio: replacementCropAspectRatio }"
            @pointerdown="beginReplacementDrag"
            @pointermove="moveReplacementDrag"
            @pointerup="endReplacementDrag"
            @pointercancel="endReplacementDrag"
            @wheel="zoomReplacementWheel"
          >
            <div
              class="absolute inset-0 bg-cover bg-center bg-no-repeat transition-[background-size,background-position] duration-150"
              :style="replacementCropStyle"
            ></div>
            <div class="pointer-events-none absolute inset-0 ring-1 ring-white/70 ring-inset"></div>
          </div>

          <p class="text-stc-text-soft mt-3 text-center text-sm font-medium">
            Seret foto di dalam frame sebelum menyimpan pengganti.
          </p>

          <div class="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              :class="[ui.secondaryButton, 'px-4 text-sm']"
              :disabled="isSavingReplacement"
              @click="resetReplacementAdjustment"
            >
              Kembalikan Posisi
            </button>
            <button
              :class="[ui.secondaryButton, 'px-4 text-sm']"
              :disabled="isSavingReplacement"
              @click="prepareUploadReplacement(replacementUpload.index)"
            >
              Ganti File
            </button>
          </div>

          <div class="mt-3 grid gap-3 sm:grid-cols-2">
            <button
              :class="[ui.secondaryButton, 'px-4 text-sm']"
              :disabled="isSavingReplacement"
              @click="clearReplacementUpload"
            >
              Batal
            </button>
            <button
              :class="[ui.primaryButton, 'px-4 text-sm']"
              :disabled="isSavingReplacement"
              @click="saveUploadReplacement"
            >
              {{ isSavingReplacement ? 'Menyimpan...' : 'Simpan Foto Pengganti' }}
            </button>
          </div>
        </div>

        <div
          v-if="reviewError"
          class="border-stc-error/30 bg-stc-error-soft text-stc-error shadow-stc-xs w-full max-w-xl rounded-xl border px-4 py-3 text-sm font-medium"
        >
          {{ reviewError }}
        </div>

        <div
          :class="[
            ui.bottomActions,
            'mt-auto max-w-xl flex-col-reverse justify-center sm:flex-row',
          ]"
        >
          <button :class="[ui.secondaryButton, 'w-full sm:flex-1']" @click="retakeAll">
            Ulang Semua
          </button>
          <button :class="[ui.primaryButton, 'w-full sm:flex-[2]']" @click="proceedToRender">
            Buat Hasil Akhir
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
