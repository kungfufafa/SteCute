<script setup lang="ts">
import { shallowRef, computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  createDefaultDecorationConfig,
  getRenderById,
  getSessionSnapshot,
  getSessionShots,
  resetSessionData,
} from '@/services/session'
import { getLayoutById } from '@/layouts'
import { getTemplateById } from '@/templates'
import { useCustomTemplateStore } from '@/app/store/useCustomTemplateStore'
import { useSessionStore } from '@/app/store/useSessionStore'
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
import FlowProgress from '@/components/common/FlowProgress.vue'

const router = useRouter()
const route = useRoute()
const sessionStore = useSessionStore()
const customTemplateStore = useCustomTemplateStore()
const capabilities = detectOutputCapabilities()
const isBusy = ref(false)
const isLoadingOutput = ref(true)
const outputError = ref<string | null>(null)
const outputActionNotice = ref<string | null>(null)
const outputActionError = ref<string | null>(null)
const showMoreActions = ref(false)

const layout = computed(
  () =>
    customTemplateStore.getLayoutById(sessionStore.layoutId) ??
    getLayoutById(sessionStore.layoutId),
)
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
  const template =
    customTemplateStore.getTemplateById(sessionStore.templateId) ??
    getTemplateById(sessionStore.templateId)
  const sessionId = sessionStore.sessionId

  if (!activeLayout || !template || !sessionId) {
    throw new Error('Render data is incomplete')
  }

  const shots = await getSessionShots(sessionId)
  const result = await renderStrip({
    layout: activeLayout,
    template,
    shots,
    decoration: createDefaultDecorationConfig(template, {
      filterId: sessionStore.filterId,
      cameraEffectId: sessionStore.cameraEffectId,
    }),
    format: 'image/png',
  })

  outputBlob.value = result.blob
  return result.blob
}

async function handleDownload() {
  isBusy.value = true
  outputActionError.value = null
  outputActionNotice.value = null
  try {
    const filename = generateFilename(sessionStore.layoutId, sessionStore.templateId, 'png')
    const blob = await getOutputBlob()
    await downloadBlob(blob, filename)
    outputActionNotice.value = 'Download dimulai.'
  } catch (error) {
    console.error('Download failed:', error)
    outputActionError.value = 'Gagal menyiapkan download. Coba buka hasil dari galeri.'
  } finally {
    isBusy.value = false
  }
}

async function handleShare() {
  isBusy.value = true
  outputActionError.value = null
  outputActionNotice.value = null
  try {
    const filename = generateFilename(sessionStore.layoutId, sessionStore.templateId, 'png')
    const blob = await getOutputBlob()
    const shared = await shareBlob(blob, filename)
    if (!shared) {
      outputActionError.value =
        'Browser ini belum mendukung share file photo strip. Gunakan download sebagai fallback.'
    }
  } catch (error) {
    console.error('Share failed:', error)
    outputActionError.value = 'Gagal membuka share sheet. Gunakan download sebagai fallback.'
  } finally {
    isBusy.value = false
  }
}

async function handleSave() {
  isBusy.value = true
  outputActionError.value = null
  outputActionNotice.value = null
  try {
    const filename = generateFilename(sessionStore.layoutId, sessionStore.templateId, 'png')
    const blob = await getOutputBlob()
    const saved = await saveBlob(blob, filename)
    if (saved) {
      outputActionNotice.value = 'Hasil berhasil disimpan.'
    } else {
      outputActionError.value =
        'Save to device tidak tersedia atau dibatalkan. Download tetap bisa dipakai.'
    }
  } catch (error) {
    console.error('Save failed:', error)
    outputActionError.value = 'Gagal menyimpan hasil. Gunakan download sebagai fallback.'
  } finally {
    isBusy.value = false
  }
}

async function handlePrint() {
  isBusy.value = true
  outputActionError.value = null
  outputActionNotice.value = null
  try {
    const blob = await getOutputBlob()
    const opened = printBlob(blob)
    if (!opened) {
      outputActionError.value = 'Popup print diblokir browser. Izinkan popup atau gunakan download.'
    }
  } catch (error) {
    console.error('Print failed:', error)
    outputActionError.value = 'Gagal membuka print preview. Gunakan download sebagai fallback.'
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

function getActiveRenderId() {
  const routeRenderId = route.query.renderId

  if (typeof routeRenderId === 'string' && routeRenderId.trim()) {
    return routeRenderId
  }

  return sessionStore.renderId
}

async function loadOutputRender() {
  isLoadingOutput.value = true
  outputError.value = null

  const renderId = getActiveRenderId()

  if (!renderId) {
    outputError.value = 'Hasil akhir tidak ditemukan. Buka galeri atau mulai sesi baru.'
    isLoadingOutput.value = false
    return
  }

  try {
    const render = await getRenderById(renderId)

    if (!render) {
      outputError.value = 'Hasil akhir tidak ditemukan di penyimpanan lokal.'
      return
    }

    const snapshot = await getSessionSnapshot(render.sessionId)

    if (snapshot) {
      sessionStore.restoreFromSession(snapshot.session, snapshot.shots)
    } else {
      sessionStore.setRenderId(renderId)
      sessionStore.setCompleted()
    }

    outputBlob.value = render.blob
    revokePreviewUrl()
    previewUrl.value = URL.createObjectURL(render.blob)
  } catch (error) {
    console.error('Failed to load output render:', error)
    outputError.value = 'Gagal memuat hasil akhir. Coba buka dari galeri.'
  } finally {
    isLoadingOutput.value = false
  }
}

onMounted(async () => {
  await loadOutputRender()
})

onBeforeUnmount(() => {
  revokePreviewUrl()
})
</script>

<template>
  <div :class="ui.page">
    <div
      v-if="isLoadingOutput"
      :class="[ui.header, 'justify-center border-none pt-8 pb-4 sm:pt-10']"
    >
      <div class="flex flex-col items-center space-y-3 text-center">
        <div
          class="bg-stc-pink-soft text-stc-pink shadow-stc-xs flex size-14 items-center justify-center rounded-xl"
        >
          <div
            class="border-r-stc-pink/30 border-t-stc-pink size-8 animate-spin rounded-full border-[3px] border-transparent"
          ></div>
        </div>
        <div>
          <h3 :class="[ui.title, 'text-2xl']">Memuat Hasil</h3>
          <p :class="ui.subtitle">Mengambil photo strip dari penyimpanan lokal.</p>
        </div>
      </div>
    </div>

    <div
      v-else-if="outputError"
      :class="[ui.header, 'justify-center border-none pt-8 pb-4 sm:pt-10']"
    >
      <div class="flex flex-col items-center space-y-3 text-center">
        <div
          class="bg-stc-warning-soft text-stc-warning shadow-stc-xs flex size-14 items-center justify-center rounded-xl"
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div>
          <h3 :class="[ui.title, 'text-2xl']">Hasil Tidak Ditemukan</h3>
          <p :class="ui.subtitle">{{ outputError }}</p>
        </div>
      </div>
    </div>

    <div v-else :class="[ui.header, 'justify-center border-none pt-8 pb-4 sm:pt-10']">
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
      <div v-if="isLoadingOutput" :class="[ui.pageContent, 'items-center gap-8']">
        <div :class="ui.emptyPanel">
          <div :class="ui.surfaceIcon">
            <div
              class="border-r-stc-pink/30 border-t-stc-pink size-8 animate-spin rounded-full border-[3px] border-transparent"
            ></div>
          </div>
          <h4 class="text-stc-text text-xl font-bold">Menyiapkan Preview</h4>
          <p
            class="text-stc-text-soft mx-auto mt-3 max-w-sm text-[0.9375rem] leading-relaxed font-medium"
          >
            Hasil akan muncul setelah data lokal selesai dibaca.
          </p>
        </div>
      </div>

      <div v-else-if="outputError" :class="[ui.pageContent, 'items-center gap-8']">
        <div :class="ui.emptyPanel">
          <h4 class="text-stc-text text-xl font-bold">Belum Ada Hasil Aktif</h4>
          <p
            class="text-stc-text-soft mx-auto mt-3 max-w-sm text-[0.9375rem] leading-relaxed font-medium"
          >
            Buka galeri untuk melihat render yang tersimpan, atau mulai sesi baru.
          </p>
          <div class="mt-8 grid w-full max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
            <button :class="ui.secondaryButton" @click="handleGallery">Buka Galeri</button>
            <button :class="ui.primaryButton" @click="handleNewSession">Mulai Foto</button>
          </div>
        </div>
      </div>

      <div v-else :class="[ui.pageContent, 'items-center gap-8']">
        <div
          class="flex w-full justify-center transition-transform duration-300 hover:scale-[1.02]"
        >
          <img
            v-if="previewUrl"
            :src="previewUrl"
            alt="Rendered strip"
            class="rendered-strip block h-auto"
            decoding="async"
          />
        </div>

        <div
          v-if="outputActionError || outputActionNotice"
          class="shadow-stc-xs w-full max-w-xl rounded-xl border px-4 py-3 text-sm font-medium"
          :class="
            outputActionError
              ? 'border-stc-error/30 bg-stc-error-soft text-stc-error'
              : 'border-stc-success/30 bg-stc-success-soft text-stc-success'
          "
        >
          {{ outputActionError ?? outputActionNotice }}
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
