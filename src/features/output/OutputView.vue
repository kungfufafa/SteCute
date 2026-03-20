<script setup lang="ts">
import { shallowRef, computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  createDecorationConfig,
  getRenderBlobById,
  getSessionShots,
  resetSessionData,
} from '@/services/session'
import { getLayoutById } from '@/layouts'
import { getTemplateById } from '@/templates'
import { useCustomizeStore, useSessionStore } from '@/stores'
import { renderStrip } from '@/services/render'
import {
  detectOutputCapabilities,
  downloadBlob,
  generateFilename,
  printBlob,
  saveBlob,
  shareBlob,
} from '@/services/output'
import { ui } from '@/ui/styles'

const router = useRouter()
const sessionStore = useSessionStore()
const customizeStore = useCustomizeStore()
const capabilities = detectOutputCapabilities()
const selectedFormat = ref<'png' | 'jpg'>('png')
const isBusy = ref(false)

const templateName = computed(() => getTemplateById(sessionStore.templateId)?.name ?? 'Classic')
const layout = computed(() => getLayoutById(sessionStore.layoutId))
const photoColors = ['#fde8f0', '#fef3c7', '#dbeafe', '#ccfbf1', '#ede9fe', '#fee2e2']
const footerText = computed(() =>
  new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date()),
)
const previewUrl = ref<string | null>(null)

// Cache the rendered blob keyed by format so we never re-render the same format twice
const blobCache = shallowRef<Record<'png' | 'jpg', Blob | null>>({ png: null, jpg: null })

function revokePreviewUrl() {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = null
  }
}

async function getOrCreateBlob(format: 'png' | 'jpg'): Promise<Blob> {
  if (blobCache.value[format]) return blobCache.value[format]!

  const activeLayout = layout.value
  const template = getTemplateById(sessionStore.templateId)
  const sessionId = sessionStore.sessionId

  if (!activeLayout || !template || !sessionId) {
    throw new Error('Render data is incomplete')
  }

  const shots = await getSessionShots(sessionId)
  const result = await renderStrip({
    layout: activeLayout,
    template,
    shots,
    decoration: createDecorationConfig({
      filterId: customizeStore.activeFilterId,
      frameColor: customizeStore.frameColor,
      selectedStickerIds: customizeStore.selectedStickerIds,
      showDateTime: customizeStore.showDateTime,
      logoText: customizeStore.logoText,
    }),
    format: format === 'png' ? 'image/png' : 'image/jpeg',
  })

  blobCache.value[format] = result.blob
  return result.blob
}

async function handleDownload() {
  isBusy.value = true
  try {
    const filename = generateFilename(
      sessionStore.layoutId,
      sessionStore.templateId,
      selectedFormat.value,
    )
    const blob = await getOrCreateBlob(selectedFormat.value)
    await downloadBlob(blob, filename)
  } finally {
    isBusy.value = false
  }
}

async function handleShare() {
  isBusy.value = true
  try {
    const filename = generateFilename(
      sessionStore.layoutId,
      sessionStore.templateId,
      selectedFormat.value,
    )
    const blob = await getOrCreateBlob(selectedFormat.value)
    await shareBlob(blob, filename)
  } finally {
    isBusy.value = false
  }
}

async function handleSave() {
  isBusy.value = true
  try {
    const filename = generateFilename(
      sessionStore.layoutId,
      sessionStore.templateId,
      selectedFormat.value,
    )
    const blob = await getOrCreateBlob(selectedFormat.value)
    await saveBlob(blob, filename)
  } finally {
    isBusy.value = false
  }
}

async function handlePrint() {
  isBusy.value = true
  try {
    const blob = await getOrCreateBlob(selectedFormat.value)
    printBlob(blob)
  } finally {
    isBusy.value = false
  }
}

function handleGallery() {
  router.push('/gallery')
}

async function handleNewSession() {
  if (sessionStore.sessionId) {
    await resetSessionData(sessionStore.sessionId)
  }
  sessionStore.reset()
  customizeStore.reset()
  router.push('/')
}

onMounted(async () => {
  if (!sessionStore.renderId) return

  const blob = await getRenderBlobById(sessionStore.renderId)
  if (!blob) return

  revokePreviewUrl()
  previewUrl.value = URL.createObjectURL(blob)
})

onBeforeUnmount(() => {
  revokePreviewUrl()
})
</script>

<template>
  <div :class="ui.page">
    <div class="px-4 pb-4 pt-12 text-center sm:px-6 lg:px-10">
      <div
        class="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-stc-success-soft text-stc-success shadow-[0_12px_24px_rgba(16,185,129,0.18)]"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h3 class="text-xl font-bold tracking-tight text-stc-text">Hasil Siap!</h3>
      <p class="mt-2 text-sm text-stc-text-faint">Photo strip kamu sudah jadi dan siap disimpan.</p>
    </div>

    <div :class="[ui.content, 'flex items-center justify-center']">
      <div :class="[ui.contentWrap, 'items-center gap-6']">
        <div
          class="w-full max-w-[18rem] overflow-hidden rounded-[28px] border border-stc-border bg-white shadow-[0_24px_60px_rgba(26,26,46,0.12)]"
        >
          <img
            v-if="previewUrl"
            :src="previewUrl"
            alt="Rendered strip"
            class="block h-auto w-full"
          />
          <template v-else>
            <div class="flex items-center justify-between border-b border-stc-border bg-white px-4 py-3">
              <span class="text-xs font-semibold text-stc-text-faint">{{ templateName }}</span>
              <span class="inline-flex items-center gap-1 text-xs font-semibold text-stc-text-faint">
                <span
                  class="inline-block size-2.5 rounded-full border border-stc-border"
                  :style="{ background: customizeStore.frameColor || '#fff' }"
                ></span>
                {{ layout?.printFormat.label ?? `${sessionStore.slotCount} Foto` }}
              </span>
            </div>
            <div
              :class="[
                'grid grid-cols-1 gap-1.5 bg-stc-bg-2 p-2',
              ]"
            >
              <div
                v-for="index in sessionStore.slotCount"
                :key="index"
                :class="[
                  'rounded-xl',
                  sessionStore.slotCount >= 6
                    ? 'h-14'
                    : sessionStore.slotCount === 4
                      ? 'h-[4.5rem]'
                      : sessionStore.slotCount === 3
                        ? 'h-24'
                        : 'h-28',
                ]"
                :style="{ background: photoColors[(index - 1) % photoColors.length] }"
              ></div>
            </div>
            <div class="border-t border-stc-border bg-white px-4 py-2 text-center">
              <span class="text-[10px] font-semibold uppercase tracking-[0.16em] text-stc-text-faint">
                stecute • {{ footerText }}
              </span>
            </div>
          </template>
        </div>

        <div class="flex w-full max-w-xl flex-col gap-4">
          <div class="flex items-center justify-center gap-2">
            <button
              :class="[
                'rounded-full border px-5 py-2 text-sm font-semibold transition-all duration-200',
                selectedFormat === 'png'
                  ? 'border-stc-pink bg-stc-pink text-white shadow-[0_10px_28px_rgba(244,91,141,0.24)]'
                  : 'border-stc-border bg-white text-stc-text-faint hover:bg-stc-bg-2',
              ]"
              @click="selectedFormat = 'png'"
            >
              PNG
            </button>
            <button
              :class="[
                'rounded-full border px-5 py-2 text-sm font-semibold transition-all duration-200',
                selectedFormat === 'jpg'
                  ? 'border-stc-pink bg-stc-pink text-white shadow-[0_10px_28px_rgba(244,91,141,0.24)]'
                  : 'border-stc-border bg-white text-stc-text-faint hover:bg-stc-bg-2',
              ]"
              @click="selectedFormat = 'jpg'"
            >
              JPG
            </button>
          </div>

          <button :class="[ui.primaryButton, 'w-full']" :disabled="isBusy" @click="handleDownload">
            Download
          </button>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              v-if="capabilities.canShare"
              :class="[ui.secondaryButton, 'w-full border-stc-blue bg-stc-blue-soft text-stc-blue']"
              @click="handleShare"
            >
              Share
            </button>
            <button v-if="capabilities.canSave" :class="[ui.secondaryButton, 'w-full']" @click="handleSave">
              Save
            </button>
            <button v-if="capabilities.canPrint" :class="[ui.secondaryButton, 'w-full']" @click="handlePrint">
              Print
            </button>
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button :class="[ui.secondaryButton, 'w-full']" @click="handleGallery">Galeri</button>
            <button :class="[ui.secondaryButton, 'w-full']" @click="handleNewSession">
              Foto Baru
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
