<script setup lang="ts">
import { shallowRef, computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { abandonIncompleteSession, getRenderById, getSessionSnapshot } from '@/services/session'
import { useSessionStore } from '@/app/store/useSessionStore'
import {
  detectOutputCapabilities,
  downloadBlob,
  generateFilename,
  getExtensionForMimeType,
  printBlob,
  saveBlob,
  shareBlob,
} from '@/services/output'
import { ui } from '@/ui/styles'
import FlowProgress from '@/components/common/FlowProgress.vue'

const router = useRouter()
const route = useRoute()
const sessionStore = useSessionStore()
const capabilities = detectOutputCapabilities()
const isBusy = ref(false)
const isLoadingOutput = ref(true)
const outputError = ref<string | null>(null)
const outputActionNotice = ref<string | null>(null)
const outputActionError = ref<string | null>(null)
const showMoreActions = ref(false)

const previewUrl = ref<string | null>(null)
const livePreviewUrl = ref<string | null>(null)
const outputBlob = shallowRef<Blob | null>(null)
const liveOutputBlob = shallowRef<Blob | null>(null)
const liveOutputMimeType = ref<string | null>(null)
const hasLiveCamOutput = computed(() => Boolean(liveOutputBlob.value && livePreviewUrl.value))

function revokePreviewUrl() {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = null
  }
}

function revokeLivePreviewUrl() {
  if (livePreviewUrl.value) {
    URL.revokeObjectURL(livePreviewUrl.value)
    livePreviewUrl.value = null
  }
}

async function getOutputBlob(): Promise<Blob> {
  if (outputBlob.value && outputBlob.value.size > 0) return outputBlob.value

  const renderId = getActiveRenderId()
  if (renderId) {
    const render = await getRenderById(renderId)
    if (render?.blob && render.blob.size > 0) {
      outputBlob.value = render.blob
      return render.blob
    }
  }

  throw new Error('Hasil akhir tidak tersedia. Buka galeri atau ulangi render.')
}

async function getLiveOutputBlob(): Promise<Blob> {
  if (!liveOutputBlob.value) {
    throw new Error('Live Cam output is unavailable')
  }

  return liveOutputBlob.value
}

async function handleDownload() {
  isBusy.value = true
  outputActionError.value = null
  outputActionNotice.value = null
  try {
    const blob = await getOutputBlob()
    const filename = generateFilename(
      sessionStore.layoutId,
      sessionStore.templateId,
      getExtensionForMimeType(blob.type),
    )
    await downloadBlob(blob, filename)
    outputActionNotice.value = 'Unduhan dimulai.'
  } catch (error) {
    console.error('Download failed:', error)
    outputActionError.value = 'Gagal menyiapkan download. Coba buka hasil dari galeri.'
  } finally {
    isBusy.value = false
  }
}

async function handleDownloadLive() {
  isBusy.value = true
  outputActionError.value = null
  outputActionNotice.value = null
  try {
    const blob = await getLiveOutputBlob()
    const extension = getExtensionForMimeType(liveOutputMimeType.value ?? blob.type)
    const filename = generateFilename(sessionStore.layoutId, sessionStore.templateId, extension)
    await downloadBlob(blob, filename)
    outputActionNotice.value = 'Unduhan Live Cam dimulai.'
  } catch (error) {
    console.error('Live Cam download failed:', error)
    outputActionError.value = 'Live Cam belum tersedia. Download foto tetap bisa dipakai.'
  } finally {
    isBusy.value = false
  }
}

async function handleShare() {
  isBusy.value = true
  outputActionError.value = null
  outputActionNotice.value = null
  try {
    const blob = await getOutputBlob()
    const filename = generateFilename(
      sessionStore.layoutId,
      sessionStore.templateId,
      getExtensionForMimeType(blob.type),
    )
    const shared = await shareBlob(blob, filename)
    if (shared === 'unsupported') {
      outputActionError.value =
        'Browser ini belum mendukung share file photo strip. Gunakan download sebagai fallback.'
    } else if (shared === 'shared') {
      outputActionNotice.value = 'Lembar bagikan dibuka.'
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
    const blob = await getOutputBlob()
    const filename = generateFilename(
      sessionStore.layoutId,
      sessionStore.templateId,
      getExtensionForMimeType(blob.type),
    )
    const saved = await saveBlob(blob, filename)
    if (saved) {
      outputActionNotice.value = 'Hasil berhasil disimpan.'
    } else {
      outputActionError.value =
        'Simpan ke perangkat tidak tersedia atau dibatalkan. Unduh tetap bisa dipakai.'
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
  await abandonIncompleteSession(sessionStore.sessionId)
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
  outputBlob.value = null
  liveOutputBlob.value = null
  liveOutputMimeType.value = null
  revokePreviewUrl()
  revokeLivePreviewUrl()

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

    sessionStore.layoutId = render.layoutId
    sessionStore.templateId = render.templateId

    if (snapshot) {
      sessionStore.restoreFromSession(snapshot.session, snapshot.shots)
    } else {
      sessionStore.setRenderId(renderId)
      sessionStore.setCompleted()
    }

    outputBlob.value = render.blob
    previewUrl.value = URL.createObjectURL(render.blob)
    liveOutputBlob.value = render.liveBlob ?? null
    liveOutputMimeType.value = render.liveMimeType ?? null
    livePreviewUrl.value = render.liveBlob ? URL.createObjectURL(render.liveBlob) : null
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
  revokeLivePreviewUrl()
})
</script>

<template>
  <div :class="ui.page">
    <div v-if="isLoadingOutput" :class="ui.header">
      <div class="min-w-0">
        <h3 :class="ui.title">Memuat Hasil</h3>
        <p :class="ui.subtitle">Mengambil photo strip dari penyimpanan lokal.</p>
      </div>
    </div>

    <div v-else-if="outputError" :class="ui.header">
      <div class="min-w-0">
        <h3 :class="ui.title">Hasil Tidak Ditemukan</h3>
        <p :class="ui.subtitle">{{ outputError }}</p>
      </div>
    </div>

    <div v-else :class="ui.header">
      <div class="min-w-0">
        <h3 :class="ui.title">Selesai!</h3>
        <p :class="ui.subtitle">
          {{
            hasLiveCamOutput
              ? 'Photo strip dan Live Cam kamu sudah jadi.'
              : 'Photo strip kamu sudah jadi dan siap diunduh.'
          }}
        </p>
      </div>
    </div>

    <FlowProgress current="output" :source="sessionStore.captureSource" />

    <div :class="ui.content">
      <div v-if="isLoadingOutput" :class="[ui.pageContent, 'items-center justify-center']">
        <div :class="ui.emptyPanel">
          <div
            class="border-stc-border border-t-stc-pink mx-auto mb-3 size-6 animate-spin rounded-full border-2"
          ></div>
          <h4 class="text-stc-text text-[15px] font-medium">Menyiapkan Preview</h4>
          <p class="text-stc-text-soft mx-auto mt-1 max-w-sm text-[13px] leading-normal">
            Hasil akan muncul setelah data lokal selesai dibaca.
          </p>
        </div>
      </div>

      <div v-else-if="outputError" :class="[ui.pageContent, 'items-center justify-center']">
        <div :class="ui.emptyPanel">
          <h4 class="text-stc-text text-[15px] font-medium">Belum Ada Hasil Aktif</h4>
          <p class="text-stc-text-soft mx-auto mt-1 max-w-sm text-[13px] leading-normal">
            Buka galeri untuk melihat render yang tersimpan, atau mulai sesi baru.
          </p>
          <div class="mt-4 flex items-center justify-center gap-2">
            <button :class="ui.secondaryButton" @click="handleGallery">Buka Galeri</button>
            <button :class="ui.primaryButton" @click="handleNewSession">Mulai Foto</button>
          </div>
        </div>
      </div>

      <div v-else :class="[ui.pageContent, 'items-center gap-6']">
        <div
          class="grid w-full max-w-4xl grid-cols-1 items-start justify-items-center gap-6 md:grid-cols-2"
          :class="{ 'md:grid-cols-1': !hasLiveCamOutput }"
        >
          <figure class="flex w-full flex-col items-center gap-3">
            <figcaption :class="ui.sectionLabel">Foto</figcaption>
            <img
              v-if="previewUrl"
              :src="previewUrl"
              alt="Photo strip hasil render"
              class="rendered-strip block h-auto"
              decoding="async"
            />
          </figure>

          <figure v-if="hasLiveCamOutput" class="flex w-full flex-col items-center gap-3">
            <figcaption :class="ui.sectionLabel">Live Cam</figcaption>
            <video
              v-if="livePreviewUrl"
              :src="livePreviewUrl"
              class="rendered-strip block h-auto"
              controls
              autoplay
              muted
              loop
              playsinline
            ></video>
          </figure>
        </div>

        <div
          v-if="outputActionError || outputActionNotice"
          class="w-full max-w-xl"
          :class="outputActionError ? ui.alertError : ui.alert"
        >
          {{ outputActionError ?? outputActionNotice }}
        </div>

        <div :class="[ui.bottomActions, 'max-w-xl !flex-col justify-center sm:!flex-col']">
          <div class="flex w-full flex-col-reverse gap-3 sm:flex-row">
            <button :class="[ui.secondaryButton, 'w-full sm:flex-1']" @click="handleNewSession">
              Foto Baru
            </button>
            <button
              :class="[ui.primaryButton, 'w-full sm:flex-[2]']"
              :disabled="isBusy"
              @click="handleDownload"
            >
              {{ hasLiveCamOutput ? 'Unduh Foto' : 'Unduh ke Perangkat' }}
            </button>
            <button
              v-if="hasLiveCamOutput"
              :class="[ui.primaryButton, 'w-full sm:flex-[2]']"
              :disabled="isBusy"
              @click="handleDownloadLive"
            >
              Unduh Live Cam
            </button>
          </div>

          <button
            :class="ui.ghostButton"
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
            class="border-stc-border grid w-full grid-cols-2 gap-2 rounded-lg border p-2 sm:grid-cols-4"
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
  max-height: calc(100dvh - 18rem);
  object-fit: contain;
}

@media (min-width: 768px) {
  .rendered-strip {
    width: auto;
    max-width: 22rem;
    max-height: calc(100dvh - 15rem);
  }
}
</style>
