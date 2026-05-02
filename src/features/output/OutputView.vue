<script setup lang="ts">
import { shallowRef, computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  createDefaultDecorationConfig,
  getRenderBlobById,
  getSessionShots,
  resetSessionData,
} from '@/services/session'
import { getLayoutById } from '@/layouts'
import { getTemplateById } from '@/templates'
import { useSessionStore } from '@/stores'
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
import StripCanvasPreview from '@/components/common/StripCanvasPreview.vue'

const router = useRouter()
const sessionStore = useSessionStore()
const capabilities = detectOutputCapabilities()
const isBusy = ref(false)
const showMoreActions = ref(false)

const activeTemplate = computed(() => getTemplateById(sessionStore.templateId))
const layout = computed(() => getLayoutById(sessionStore.layoutId))
const previewUrl = ref<string | null>(null)
const outputBlob = shallowRef<Blob | null>(null)

function revokePreviewUrl() {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = null
  }
}

async function getOutputBlob(): Promise<Blob> {
  if (outputBlob.value) return outputBlob.value

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
    decoration: createDefaultDecorationConfig(template),
    format: 'image/png',
  })

  outputBlob.value = result.blob
  return result.blob
}

async function handleDownload() {
  isBusy.value = true
  try {
    const filename = generateFilename(sessionStore.layoutId, sessionStore.templateId, 'png')
    const blob = await getOutputBlob()
    await downloadBlob(blob, filename)
  } finally {
    isBusy.value = false
  }
}

async function handleShare() {
  isBusy.value = true
  try {
    const filename = generateFilename(sessionStore.layoutId, sessionStore.templateId, 'png')
    const blob = await getOutputBlob()
    await shareBlob(blob, filename)
  } finally {
    isBusy.value = false
  }
}

async function handleSave() {
  isBusy.value = true
  try {
    const filename = generateFilename(sessionStore.layoutId, sessionStore.templateId, 'png')
    const blob = await getOutputBlob()
    await saveBlob(blob, filename)
  } finally {
    isBusy.value = false
  }
}

async function handlePrint() {
  isBusy.value = true
  try {
    const blob = await getOutputBlob()
    printBlob(blob)
  } finally {
    isBusy.value = false
  }
}

function handleGallery() {
  router.push('/gallery')
}

function toggleMoreActions() {
  showMoreActions.value = !showMoreActions.value
}

async function handleNewSession() {
  if (sessionStore.sessionId) {
    await resetSessionData(sessionStore.sessionId)
  }
  sessionStore.reset()
  router.push('/')
}

onMounted(async () => {
  if (!sessionStore.renderId) return

  const blob = await getRenderBlobById(sessionStore.renderId)
  if (!blob) return

  outputBlob.value = blob
  revokePreviewUrl()
  previewUrl.value = URL.createObjectURL(blob)
})

onBeforeUnmount(() => {
  revokePreviewUrl()
})
</script>

<template>
  <div :class="ui.page">
    <div class="px-4 pt-12 pb-4 text-center sm:px-6 lg:px-10">
      <div
        class="bg-stc-success-soft text-stc-success mx-auto mb-4 flex size-14 items-center justify-center rounded-full"
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
      <h3 class="text-stc-text text-xl font-bold tracking-tight">Hasil Siap</h3>
      <p class="text-stc-text-faint mt-2 text-sm">Photo strip kamu sudah jadi dan siap disimpan.</p>
    </div>

    <div :class="[ui.content, 'flex items-center justify-center']">
      <div :class="[ui.contentWrap, 'items-center gap-6']">
        <div class="w-full max-w-[20rem]">
          <img
            v-if="previewUrl"
            :src="previewUrl"
            alt="Rendered strip"
            class="border-stc-border shadow-stc-sm block h-auto w-full rounded-xl border"
          />
          <StripCanvasPreview v-else :layout="layout" :template-config="activeTemplate" />
        </div>

        <div class="flex w-full max-w-xl flex-col gap-3">
          <button :class="[ui.primaryButton, 'w-full']" :disabled="isBusy" @click="handleDownload">
            Download
          </button>

          <button :class="[ui.secondaryButton, 'w-full']" @click="handleNewSession">
            Foto Baru
          </button>

          <button
            class="text-stc-text-soft hover:text-stc-pink inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition-colors duration-150"
            :aria-expanded="showMoreActions"
            aria-controls="output-secondary-actions"
            @click="toggleMoreActions"
          >
            {{ showMoreActions ? 'Tutup opsi' : 'Opsi lain' }}
          </button>

          <div
            v-if="showMoreActions"
            id="output-secondary-actions"
            class="border-stc-border bg-stc-bg-2 grid grid-cols-1 gap-2 rounded-2xl border p-3 sm:grid-cols-2"
          >
            <button
              v-if="capabilities.canShare"
              :class="[ui.secondaryButton, 'w-full']"
              :disabled="isBusy"
              @click="handleShare"
            >
              Bagikan
            </button>
            <button
              v-if="capabilities.canSave"
              :class="[ui.secondaryButton, 'w-full']"
              :disabled="isBusy"
              @click="handleSave"
            >
              Simpan
            </button>
            <button
              v-if="capabilities.canPrint"
              :class="[ui.secondaryButton, 'w-full']"
              :disabled="isBusy"
              @click="handlePrint"
            >
              Cetak
            </button>
            <button :class="[ui.secondaryButton, 'w-full']" @click="handleGallery">
              Lihat Galeri
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
