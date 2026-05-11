<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { SlotConfig } from '@/db/schema'
import {
  createDefaultDecorationConfig,
  createSession,
  resetSessionData,
  saveShot,
} from '@/services/session'
import { useCustomTemplateStore } from '@/app/store/useCustomTemplateStore'
import { useSessionStore } from '@/app/store/useSessionStore'
import {
  createAdjustedImageBlob,
  createAutoUploadImageAdjustment,
  clampUploadImageAdjustment,
  getAdjustedCropRect,
  getImageDimensions,
  openImagePicker,
  type UploadImageAdjustment,
  validateFile,
  validateFiles,
} from '@/services/upload'
import { getStorageErrorMessage, isStorageQuotaError } from '@/services/storage'
import { ui } from '@/ui/styles'
import { getLayoutById } from '@/layouts'
import { getTemplateById, resolveTemplateLayout } from '@/templates'
import StripCanvasPreview from '@/components/common/StripCanvasPreview.vue'
import FlowProgress from '@/components/common/FlowProgress.vue'

interface UploadItem {
  file: File
  url: string
  width: number
  height: number
  adjustment: UploadImageAdjustment
}

interface DragState {
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
const errors = ref<string[]>([])
const uploadItems = ref<UploadItem[]>([])
const activeIndex = ref(0)
const dragState = ref<DragState | null>(null)

const isPreparing = ref(false)
const isProcessing = ref(false)
const isBusy = computed(() => isPreparing.value || isProcessing.value)
const hasUploads = computed(() => uploadItems.value.length > 0)
const activeItem = computed(() => uploadItems.value[activeIndex.value] ?? null)
const activeSlot = computed(() => getSlotForIndex(activeIndex.value))
const isReadyToProcess = computed(() => uploadItems.value.length === sessionStore.slotCount)
const activePhotoLabel = computed(() => {
  if (!activeItem.value) return 'Foto'
  return `Foto ${activeIndex.value + 1}`
})
const activeCropStyle = computed(() => {
  const item = activeItem.value
  if (!item) return {}

  if (item.adjustment.fit === 'contain') {
    return {
      backgroundColor: '#fff7fa',
      backgroundImage: `url("${item.url}")`,
      backgroundPosition: '50% 50%',
      backgroundSize: 'contain',
    }
  }

  const slot = activeSlot.value
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
const activeCropAspectRatio = computed(
  () => `${activeSlot.value.width} / ${activeSlot.value.height}`,
)

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`
  }

  if (error && typeof error === 'object') {
    const details = error as { name?: unknown; message?: unknown; code?: unknown }
    return JSON.stringify({
      name: details.name,
      message: details.message,
      code: details.code,
    })
  }

  return String(error)
}

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

function resetUploadItems() {
  uploadItems.value.forEach((item) => URL.revokeObjectURL(item.url))
  uploadItems.value = []
  activeIndex.value = 0
}

async function createUploadItems(files: File[]): Promise<UploadItem[]> {
  const items: UploadItem[] = []

  try {
    for (const [index, file] of files.entries()) {
      const dimensions = await getImageDimensions(file)
      const slot = getSlotForIndex(index)
      items.push({
        file,
        url: URL.createObjectURL(file),
        width: dimensions.width,
        height: dimensions.height,
        adjustment: createAutoAdjustment(dimensions.width, dimensions.height, slot),
      })
    }

    return items
  } catch (error) {
    items.forEach((item) => URL.revokeObjectURL(item.url))
    throw error
  }
}

async function setSelectedFiles(files: File[]) {
  const items = await createUploadItems(files)
  resetUploadItems()
  uploadItems.value = items
}

async function handleFileSelect() {
  if (isBusy.value) return

  const files = await openImagePicker(true)
  if (!files) return

  const selected = Array.from(files)
  const validation = validateFiles(selected, sessionStore.slotCount)

  if (!validation.valid) {
    errors.value = validation.errors
    return
  }

  isPreparing.value = true

  try {
    await setSelectedFiles(selected)
    errors.value = []
  } catch (error) {
    console.error(`Upload preview failed: ${describeError(error)}`)
    errors.value = ['Satu atau lebih foto gagal dibaca. Pilih file lain dan coba lagi.']
  } finally {
    isPreparing.value = false
  }
}

function goBack() {
  router.push({ path: '/config', query: { source: 'upload' } })
}

function selectPhoto(index: number) {
  if (index < 0 || index >= uploadItems.value.length) return
  activeIndex.value = index
  dragState.value = null
}

function setActiveAdjustment(adjustment: Partial<UploadImageAdjustment>) {
  const item = activeItem.value
  if (!item) return

  item.adjustment = clampUploadImageAdjustment({
    ...item.adjustment,
    ...adjustment,
  })
}

function resetActiveAdjustment() {
  const item = activeItem.value
  if (!item) return

  setActiveAdjustment(createAutoAdjustment(item.width, item.height, activeSlot.value))
  dragState.value = null
}

function adjustActiveZoom(delta: number) {
  const item = activeItem.value
  if (!item) return

  setActiveAdjustment({ fit: 'cover', zoom: item.adjustment.zoom + delta })
}

function zoomPhotoWheel(event: globalThis.WheelEvent) {
  event.preventDefault()
  adjustActiveZoom(event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP)
}

function applyAutoCropToAll() {
  uploadItems.value.forEach((uploadItem, index) => {
    uploadItem.adjustment = createAutoAdjustment(
      uploadItem.width,
      uploadItem.height,
      getSlotForIndex(index),
    )
  })
  dragState.value = null
}

function beginPhotoDrag(event: globalThis.PointerEvent) {
  if (isBusy.value || !activeItem.value) return

  const target = event.currentTarget as PhotoDragTarget | null
  if (!target) return

  target.setPointerCapture(event.pointerId)
  dragState.value = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startOffsetX: activeItem.value.adjustment.offsetX,
    startOffsetY: activeItem.value.adjustment.offsetY,
    width: target.clientWidth,
    height: target.clientHeight,
  }
}

function movePhotoDrag(event: globalThis.PointerEvent) {
  const state = dragState.value
  const item = activeItem.value
  if (!state || !item || state.pointerId !== event.pointerId) return

  const zoomDamping = Math.max(1, item.adjustment.zoom)
  const deltaX = ((event.clientX - state.startX) / Math.max(1, state.width)) * 2
  const deltaY = ((event.clientY - state.startY) / Math.max(1, state.height)) * 2

  setActiveAdjustment({
    fit: 'cover',
    offsetX: state.startOffsetX - deltaX / zoomDamping,
    offsetY: state.startOffsetY - deltaY / zoomDamping,
  })
}

function endPhotoDrag(event: globalThis.PointerEvent) {
  if (dragState.value?.pointerId !== event.pointerId) return

  const target = event.currentTarget as PhotoDragTarget | null
  if (!target) return

  if (target.hasPointerCapture(event.pointerId)) {
    target.releasePointerCapture(event.pointerId)
  }

  dragState.value = null
}

async function replaceActiveFile() {
  if (isBusy.value || !activeItem.value) return

  const files = await openImagePicker(false)
  const file = files?.[0]

  if (!file) return

  const validation = validateFile(file)

  if (!validation.valid) {
    errors.value = validation.errors
    return
  }

  isPreparing.value = true

  try {
    const [replacement] = await createUploadItems([file])
    const previous = uploadItems.value[activeIndex.value]
    if (previous) URL.revokeObjectURL(previous.url)
    uploadItems.value.splice(activeIndex.value, 1, replacement)
    errors.value = []
  } catch (error) {
    console.error(`Upload replacement failed: ${describeError(error)}`)
    errors.value = ['Foto pengganti gagal dibaca. Pilih file lain dan coba lagi.']
  } finally {
    isPreparing.value = false
  }
}

async function processUpload() {
  if (!isReadyToProcess.value) {
    errors.value = [`Layout ini membutuhkan tepat ${sessionStore.slotCount} foto.`]
    return
  }

  isProcessing.value = true
  let sessionId: string | undefined

  try {
    sessionId = await createSession({
      layoutId: sessionStore.layoutId,
      templateId: sessionStore.templateId,
      slotCount: sessionStore.slotCount,
      captureSource: 'upload',
      decoration: createDefaultDecorationConfig(activeTemplate.value),
    })

    sessionStore.startSession(sessionId, 'upload', sessionStore.slotCount)

    for (const [index, item] of uploadItems.value.entries()) {
      const slot = getSlotForIndex(index)
      const adjusted = await createAdjustedImageBlob(item.file, {
        targetWidth: slot.width,
        targetHeight: slot.height,
        adjustment: item.adjustment,
      })
      const shotId = await saveShot({
        sessionId,
        order: index,
        sourceType: 'upload',
        blob: adjusted.blob,
        width: adjusted.width,
        height: adjusted.height,
      })
      sessionStore.addShotId(shotId)
    }

    sessionStore.setReviewing()
    router.push('/review')
  } catch (error) {
    console.error(`Upload failed: ${describeError(error)}`)
    if (sessionId) {
      await resetSessionData(sessionId).catch(() => {})
    }
    errors.value = [
      isStorageQuotaError(error)
        ? getStorageErrorMessage(error)
        : 'Gagal memproses foto. Silakan coba lagi.',
    ]
  } finally {
    isProcessing.value = false
  }
}

onBeforeUnmount(() => resetUploadItems())
</script>

<template>
  <div :class="ui.page">
    <div :class="ui.header">
      <div :class="ui.headerGroup">
        <button :class="ui.iconButton" aria-label="Kembali ke beranda" @click="goBack">
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
          <h3 :class="ui.title">Upload Foto</h3>
          <p :class="ui.subtitle">
            Pilih tepat {{ sessionStore.slotCount }} foto untuk strip Anda.
          </p>
        </div>
      </div>
      <span :class="ui.badge">{{
        activeLayout?.printFormat.paperSize ?? `${sessionStore.slotCount} Foto`
      }}</span>
    </div>

    <FlowProgress current="capture" source="upload" />

    <div :class="ui.content">
      <div
        :class="[
          ui.pageContentWide,
          'grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start',
        ]"
      >
        <section class="min-w-0 space-y-6">
          <div class="max-w-2xl space-y-2">
            <p :class="ui.sectionLabel">Upload Lokal</p>
            <h2 :class="ui.sectionTitle">Masukkan foto sesuai slot.</h2>
            <p :class="ui.sectionCopy">
              JPG, PNG, atau WebP maksimal 10 MB per file. Semua foto diproses lokal di perangkat
              ini untuk menjaga privasi.
            </p>
          </div>

          <button
            v-if="!hasUploads"
            class="group border-stc-border-strong shadow-stc-xs hover:border-stc-pink hover:bg-stc-pink-soft hover:shadow-stc-sm focus-visible:ring-stc-pink flex min-h-[280px] w-full max-w-[38rem] flex-col items-center justify-center rounded-xl border-2 border-dashed bg-white px-5 py-8 text-center transition-all duration-200 outline-none hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-offset-2 active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 sm:min-h-[330px] sm:px-6 sm:py-10"
            :disabled="isBusy"
            @click="handleFileSelect"
          >
            <div
              class="bg-stc-pink-soft text-stc-pink shadow-stc-xs mb-5 flex size-16 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105 sm:size-20"
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <h4
              class="text-stc-text group-hover:text-stc-pink-strong text-xl font-bold transition-colors"
            >
              {{ isPreparing ? 'Menyiapkan...' : 'Pilih Foto Lokal' }}
            </h4>
            <p
              class="text-stc-text-faint group-hover:text-stc-pink/80 mt-2 text-sm font-medium transition-colors"
            >
              {{ `${sessionStore.slotCount} file untuk sekali render` }}
            </p>
          </button>

          <div v-else class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_220px]">
            <div :class="[ui.panel, 'p-4 sm:p-5']">
              <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p :class="ui.sectionLabel">Foto Ini</p>
                  <h3 class="text-stc-text mt-1 text-lg font-bold">
                    {{ activePhotoLabel }} dari {{ sessionStore.slotCount }}
                  </h3>
                </div>
                <span :class="ui.pinkBadge">Slot {{ activeIndex + 1 }}</span>
              </div>

              <div
                class="border-stc-border bg-stc-bg-2 relative mx-auto w-full max-w-2xl cursor-grab touch-none overflow-hidden rounded-xl border select-none active:cursor-grabbing"
                :style="{ aspectRatio: activeCropAspectRatio }"
                @pointerdown="beginPhotoDrag"
                @pointermove="movePhotoDrag"
                @pointerup="endPhotoDrag"
                @pointercancel="endPhotoDrag"
                @wheel="zoomPhotoWheel"
              >
                <div
                  class="absolute inset-0 bg-cover bg-center bg-no-repeat transition-[background-size,background-position] duration-150"
                  :style="activeCropStyle"
                ></div>
                <div
                  class="pointer-events-none absolute inset-0 ring-1 ring-white/70 ring-inset"
                ></div>
              </div>

              <p class="text-stc-text-soft mt-3 text-center text-sm font-medium">
                Seret foto di dalam frame kalau posisinya kurang pas. Crop awal sudah otomatis.
              </p>

              <div class="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  :class="[ui.secondaryButton, 'gap-2 px-4 text-sm']"
                  :disabled="isBusy"
                  aria-label="Kembalikan posisi foto ini"
                  @click="resetActiveAdjustment"
                >
                  <svg
                    class="size-4 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.4"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 12a9 9 0 1 0 3-6.7" />
                    <path d="M3 4v6h6" />
                  </svg>
                  Kembalikan Posisi
                </button>

                <button
                  :class="[ui.secondaryButton, 'gap-2 px-4 text-sm']"
                  :disabled="isBusy"
                  @click="replaceActiveFile"
                >
                  <svg
                    class="size-4 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.4"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="m8 13 2.5-2.5 3 3L15 12l3 3" />
                    <path d="M14 8h4" />
                    <path d="M16 6v4" />
                  </svg>
                  Ganti Foto Ini
                </button>
              </div>
            </div>

            <div class="space-y-4">
              <p :class="ui.sectionLabel">Daftar Foto</p>
              <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-2">
                <button
                  v-for="(item, index) in uploadItems"
                  :key="item.url"
                  class="group focus-visible:ring-stc-pink shadow-stc-xs relative aspect-[4/3] overflow-hidden rounded-xl border bg-white transition-all duration-200 outline-none hover:-translate-y-[1px] focus-visible:ring-2 focus-visible:ring-offset-2 active:translate-y-0 active:scale-[0.98]"
                  :class="
                    index === activeIndex
                      ? 'border-stc-pink ring-stc-pink/20 ring-4'
                      : 'border-stc-border hover:border-stc-pink/50'
                  "
                  :aria-label="`Atur foto ${index + 1}`"
                  :disabled="isBusy"
                  @click="selectPhoto(index)"
                >
                  <img
                    :src="item.url"
                    :alt="`Upload ${index + 1}`"
                    class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    decoding="async"
                  />
                  <span
                    class="text-stc-text shadow-stc-xs absolute top-1.5 left-1.5 flex size-7 items-center justify-center rounded-lg bg-white/95 text-xs font-bold"
                  >
                    {{ index + 1 }}
                  </span>
                </button>
              </div>

              <div :class="[ui.panelSoft, 'p-3']">
                <p :class="ui.sectionLabel">Semua Foto</p>
                <div class="mt-3 grid gap-3">
                  <button
                    :class="[ui.secondaryButton, 'gap-2 px-4 text-sm']"
                    :disabled="isBusy"
                    @click="applyAutoCropToAll"
                  >
                    <svg
                      class="size-4 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.4"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M4 7h16" />
                      <path d="M7 4v16" />
                      <path d="M17 4v16" />
                      <path d="M4 17h16" />
                    </svg>
                    Rapikan Semua
                  </button>

                  <button
                    :class="[ui.secondaryButton, 'gap-2 px-4 text-sm']"
                    :disabled="isBusy"
                    @click="handleFileSelect"
                  >
                    <svg
                      class="size-4 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.4"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <path d="m17 8-5-5-5 5" />
                      <path d="M12 3v12" />
                    </svg>
                    Pilih Ulang Semua
                  </button>
                </div>
              </div>
            </div>

            <div class="xl:col-span-2">
              <div :class="[ui.bottomActions, 'pt-0 sm:max-w-xl']">
                <button :class="ui.secondaryButton" :disabled="isBusy" @click="goBack">
                  Kembali
                </button>
                <button
                  :class="ui.primaryButton"
                  :disabled="isBusy || !isReadyToProcess"
                  @click="processUpload"
                >
                  {{ isProcessing ? 'Menyiapkan Preview...' : 'Lanjut ke Preview' }}
                </button>
              </div>
            </div>
          </div>

          <div
            v-if="errors.length > 0"
            class="border-stc-error/30 bg-stc-error-soft shadow-stc-xs rounded-xl border p-5 sm:p-6"
          >
            <p class="text-stc-error mb-4 text-[0.6875rem] font-bold uppercase">Masalah Upload</p>
            <div class="space-y-3">
              <div
                v-for="(error, index) in errors"
                :key="error"
                class="text-stc-error flex items-start gap-3 text-sm font-medium"
              >
                <span
                  class="text-stc-error shadow-stc-xs mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold"
                >
                  {{ index + 1 }}
                </span>
                <span class="leading-relaxed">{{ error }}</span>
              </div>
            </div>
          </div>
        </section>

        <aside class="lg:sticky lg:top-8" aria-label="Ringkasan format upload">
          <div :class="[ui.panel, 'p-5 sm:p-6']">
            <div class="mb-5 flex items-start justify-between gap-4">
              <div>
                <p :class="ui.sectionLabel">Slot</p>
                <h3 class="text-stc-text mt-1 text-lg font-bold">
                  {{ activeLayout?.printFormat.label ?? `${sessionStore.slotCount} Foto` }}
                </h3>
              </div>
              <span :class="ui.badge">{{ sessionStore.slotCount }} Foto</span>
            </div>

            <div class="mx-auto max-w-[190px]">
              <StripCanvasPreview :layout="activeLayout" :template-config="activeTemplate" />
            </div>

            <div class="mt-6 space-y-3">
              <div :class="['flex items-center justify-between gap-4', ui.softTile]">
                <span class="text-stc-text-soft text-sm font-semibold">Template</span>
                <span class="text-stc-text text-sm font-bold">
                  {{ activeTemplate?.name ?? 'Classic' }}
                </span>
              </div>
              <div :class="['flex items-center justify-between gap-4', ui.softTile]">
                <span class="text-stc-text-soft text-sm font-semibold">Format</span>
                <span class="text-stc-text text-sm font-bold">JPG/PNG/WebP</span>
              </div>
              <div :class="['flex items-center justify-between gap-4', ui.softTile]">
                <span class="text-stc-text-soft text-sm font-semibold">Batas file</span>
                <span class="text-stc-text text-sm font-bold">10 MB</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>
