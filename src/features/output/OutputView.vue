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
import FlowProgress from '@/components/common/FlowProgress.vue'

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
    <div :class="[ui.header, 'justify-center border-none pt-8 pb-4 sm:pt-10']">
      <div class="flex flex-col items-center space-y-3 text-center">
        <div
          class="bg-stc-success-soft text-stc-success shadow-stc-xs flex size-14 items-center justify-center rounded-xl"
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div>
          <h3 :class="[ui.title, 'text-2xl']">Selesai!</h3>
          <p :class="ui.subtitle">Photo strip kamu sudah jadi dan siap diunduh.</p>
        </div>
      </div>
    </div>

    <FlowProgress current="output" :source="sessionStore.captureSource" />

    <div :class="[ui.content, 'flex flex-col']">
      <div :class="[ui.pageContent, 'items-center gap-8']">
        <div
          class="flex w-full justify-center transition-transform duration-300 hover:scale-[1.02]"
        >
          <img
            v-if="previewUrl"
            :src="previewUrl"
            alt="Rendered strip"
            class="rendered-strip border-stc-border shadow-stc-md block h-auto rounded-xl border bg-white"
          />
          <StripCanvasPreview
            v-else
            :layout="layout"
            :template-config="activeTemplate"
            fit-viewport
          />
        </div>

        <div :class="[ui.bottomActions, 'mt-auto max-w-xl !flex-col justify-center sm:!flex-col']">
          <div class="flex w-full flex-col-reverse gap-3 sm:flex-row">
            <button :class="[ui.secondaryButton, 'w-full sm:flex-1']" @click="handleNewSession">
              Foto Baru
            </button>
            <button
              :class="[ui.primaryButton, 'w-full sm:flex-[2]']"
              :disabled="isBusy"
              @click="handleDownload"
            >
              Unduh ke Perangkat
            </button>
          </div>

          <button
            class="text-stc-text-soft hover:text-stc-pink focus-visible:ring-stc-pink inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-sm font-bold transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98]"
            :aria-expanded="showMoreActions"
            aria-controls="output-secondary-actions"
            @click="toggleMoreActions"
          >
            <span class="flex items-center gap-2">
              {{ showMoreActions ? 'Tutup opsi tambahan' : 'Lihat opsi tambahan' }}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="transition-transform duration-200"
                :class="{ 'rotate-180': showMoreActions }"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </span>
          </button>

          <div
            v-if="showMoreActions"
            id="output-secondary-actions"
            class="border-stc-border/60 bg-stc-bg-2 shadow-stc-xs grid w-full grid-cols-2 gap-3 rounded-xl border p-3 duration-200 sm:grid-cols-4 sm:p-4"
          >
            <button
              v-if="capabilities.canShare"
              :class="ui.actionTile"
              :disabled="isBusy"
              @click="handleShare"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
              Bagikan
            </button>
            <button
              v-if="capabilities.canSave"
              :class="ui.actionTile"
              :disabled="isBusy"
              @click="handleSave"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              Simpan
            </button>
            <button
              v-if="capabilities.canPrint"
              :class="ui.actionTile"
              :disabled="isBusy"
              @click="handlePrint"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="6 9 6 2 18 2 18 9" />
                <path
                  d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"
                />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              Cetak
            </button>
            <button :class="ui.actionTile" @click="handleGallery">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              Galeri
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rendered-strip {
  width: min(100%, 20rem);
  max-width: 20rem;
  max-height: calc(100dvh - 19rem);
  object-fit: contain;
}

@media (min-width: 768px) {
  .rendered-strip {
    width: auto;
    max-width: 22rem;
    max-height: calc(100dvh - 16rem);
  }
}
</style>
