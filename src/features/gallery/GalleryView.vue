<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/app/store/useAppStore'
import { useCustomTemplateStore } from '@/app/store/useCustomTemplateStore'
import { useGalleryStore } from '@/app/store/useGalleryStore'
import { useSessionStore } from '@/app/store/useSessionStore'
import type { Render } from '@/db/schema'
import { GALLERY_RETENTION_LIMIT } from '@/db/repositories/render'
import { getLayoutById } from '@/layouts'
import { getTemplateById } from '@/templates'
import { downloadBlob, generateFilename, getExtensionForMimeType } from '@/services/output'
import { clearAllLocalData, getStorageState, type StorageState } from '@/services/storage'
import { formatBytes, formatGalleryDate } from '@/utils/format'
import { ui } from '@/ui/styles'

const router = useRouter()
const appStore = useAppStore()
const galleryStore = useGalleryStore()
const sessionStore = useSessionStore()
const customTemplateStore = useCustomTemplateStore()
const renderUrls = ref<Record<string, string>>({})
const storageState = ref<StorageState | null>(null)
const localDataMessage = ref<string | null>(null)
const showLocalDataOptions = ref(false)

onMounted(() => {
  void loadGallery()
})

function goBack() {
  router.push('/')
}

function galleryCaption(render: Render) {
  const template = getTemplateById(render.templateId)?.name ?? 'Strip'
  const layout = getLayoutById(render.layoutId)?.name
  return layout ? `${template} · ${layout}` : template
}

function hasLiveCam(render: Render) {
  return Boolean(render.liveBlob)
}

function handleDelete(id: string) {
  if (confirm('Hapus photo strip ini?')) {
    void removeAndReload(id)
  }
}

function handleClearAll() {
  if (confirm('Kosongkan galeri? Semua photo strip tersimpan akan dihapus.')) {
    void clearAndReload()
  }
}

function revokeRenderUrls() {
  Object.values(renderUrls.value).forEach((url) => URL.revokeObjectURL(url))
  renderUrls.value = {}
}

async function loadGallery() {
  await galleryStore.loadRecent()
  storageState.value = await getStorageState()
  revokeRenderUrls()

  renderUrls.value = Object.fromEntries(
    galleryStore.recentRenders.map((render) => [render.id, URL.createObjectURL(render.blob)]),
  )
}

async function removeAndReload(id: string) {
  await galleryStore.removeRender(id)
  await loadGallery()
}

async function clearAndReload() {
  await galleryStore.clearAll()
  revokeRenderUrls()
  storageState.value = await getStorageState()
}

async function handleClearAllLocalData() {
  const confirmed = confirm(
    'Bersihkan semua data lokal Stecute? Galeri, sesi, blanko upload, setting, dan cache offline akan dihapus. Aplikasi perlu internet lagi untuk cache ulang.',
  )

  if (!confirmed) return

  try {
    await clearAllLocalData()
    sessionStore.reset()
    customTemplateStore.clearTemplate()
    appStore.markOfflineCacheCleared()
    galleryStore.recentRenders = []
    revokeRenderUrls()
    storageState.value = await getStorageState()
    localDataMessage.value = 'Semua data lokal berhasil dihapus.'
  } catch (error) {
    console.error('Failed to clear local data:', error)
    localDataMessage.value = 'Gagal menghapus semua data lokal. Coba lagi dari pengaturan browser.'
  }
}

function toggleLocalDataOptions() {
  showLocalDataOptions.value = !showLocalDataOptions.value
}

async function handleDownload(renderId: string) {
  const render = galleryStore.recentRenders.find((item) => item.id === renderId)
  if (!render) return

  const extension = render.mimeType === 'image/jpeg' ? 'jpg' : 'png'
  const filename = generateFilename(render.layoutId, render.templateId, extension)
  await downloadBlob(render.blob, filename)
}

async function handleDownloadLive(renderId: string) {
  const render = galleryStore.recentRenders.find((item) => item.id === renderId)
  if (!render?.liveBlob) return

  const extension = getExtensionForMimeType(render.liveMimeType ?? render.liveBlob.type)
  const filename = generateFilename(render.layoutId, render.templateId, extension)
  await downloadBlob(render.liveBlob, filename)
}

function openOutput(renderId: string) {
  router.push({ path: '/output', query: { renderId } })
}

onBeforeUnmount(() => {
  revokeRenderUrls()
})
</script>

<template>
  <div :class="ui.page">
    <div :class="ui.headerWide">
      <div :class="ui.headerGroup">
        <button :class="ui.iconButton" aria-label="Kembali ke beranda" @click="goBack">
          <svg
            width="16"
            height="16"
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
        <h1 :class="ui.title">Galeri</h1>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <span
          :class="ui.pinkBadge"
          :aria-label="`${galleryStore.recentRenders.length} dari ${GALLERY_RETENTION_LIMIT} strip`"
        >
          {{ galleryStore.recentRenders.length }}/{{ GALLERY_RETENTION_LIMIT }}
        </span>
        <button
          v-if="galleryStore.recentRenders.length > 0"
          :class="[ui.ghostButton, 'text-stc-error hover:bg-stc-error-soft']"
          aria-label="Kosongkan galeri"
          @click="handleClearAll"
        >
          Kosongkan
        </button>
      </div>
    </div>

    <div :class="ui.content">
      <div :class="[ui.pageContentWide, 'flex flex-col gap-6']">
        <div
          v-if="storageState?.shouldWarn || localDataMessage"
          :class="storageState?.shouldWarn ? ui.alertWarning : ui.alert"
        >
          <template v-if="storageState?.shouldWarn">
            Penyimpanan lokal mulai tinggi
            <span v-if="storageState.quotaBytes">
              ({{ formatBytes(storageState.usageBytes) }} dari
              {{ formatBytes(storageState.quotaBytes) }}).
            </span>
            Hapus hasil lama jika render berikutnya gagal disimpan.
          </template>
          <template v-else>
            {{ localDataMessage }}
          </template>
        </div>

        <div
          v-if="galleryStore.recentRenders.length === 0"
          :class="[ui.emptyPanel, 'max-w-none py-12']"
        >
          <div :class="ui.surfaceIcon" aria-hidden="true">
            <svg
              width="16"
              height="16"
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
          </div>
          <h4 class="text-stc-text text-[15px] font-medium">Belum Ada Hasil</h4>
          <p class="text-stc-text-soft mx-auto mt-1 max-w-sm text-[13px] leading-normal">
            Hasil tersimpan di perangkat ini, maksimal {{ GALLERY_RETENTION_LIMIT }} strip.
          </p>
          <div class="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button :class="ui.primaryButton" @click="router.push('/')">Mulai Foto</button>
            <button :class="ui.secondaryButton" @click="router.push('/booth')">Foto Duet</button>
          </div>
        </div>

        <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          <article
            v-for="(render, index) in galleryStore.recentRenders"
            :key="render.id"
            class="border-stc-border group shadow-stc-xs hover:shadow-stc-sm overflow-hidden rounded-lg border bg-white transition duration-150 hover:-translate-y-0.5"
          >
            <div class="relative">
              <button
                class="bg-stc-bg-2 flex aspect-[3/4] w-full items-center justify-center px-3 pt-4 pb-3"
                :aria-label="`Buka hasil ${index + 1}`"
                @click="openOutput(render.id)"
              >
                <img
                  :src="renderUrls[render.id]"
                  :alt="`Render ${index + 1}`"
                  class="shadow-stc-sm max-h-full w-auto max-w-full object-contain"
                  loading="lazy"
                  decoding="async"
                />
              </button>
              <div class="absolute top-2 right-2 flex gap-1">
                <button
                  class="shadow-stc-xs text-stc-text focus-visible:ring-stc-pink/40 flex size-7 items-center justify-center rounded-md bg-white/90 backdrop-blur-sm outline-none hover:bg-white focus-visible:ring-2"
                  :aria-label="`Unduh render ${index + 1}`"
                  @click="handleDownload(render.id)"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </button>
                <button
                  v-if="hasLiveCam(render)"
                  class="shadow-stc-xs text-stc-text focus-visible:ring-stc-pink/40 flex size-7 items-center justify-center rounded-md bg-white/90 backdrop-blur-sm outline-none hover:bg-white focus-visible:ring-2"
                  :aria-label="`Unduh Live Cam ${index + 1}`"
                  title="Unduh video"
                  @click="handleDownloadLive(render.id)"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </button>
                <button
                  class="shadow-stc-xs text-stc-error hover:bg-stc-error-soft focus-visible:ring-stc-pink/40 flex size-7 items-center justify-center rounded-md bg-white/90 backdrop-blur-sm outline-none focus-visible:ring-2"
                  :aria-label="`Hapus render ${index + 1}`"
                  @click="handleDelete(render.id)"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path
                      d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <div class="px-3 py-2.5">
              <p class="text-stc-text truncate text-[13px] font-medium">
                {{ formatGalleryDate(render.createdAt) }}
              </p>
              <p class="text-stc-text-faint truncate text-[12px]">
                {{ galleryCaption(render) }}
              </p>
            </div>
          </article>
        </div>

        <div :class="[ui.panelSoft, 'px-4']">
          <div class="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="min-w-0">
              <p class="text-stc-text text-[13px] font-medium">Data lokal aplikasi</p>
              <p class="text-stc-text-soft mt-0.5 text-[13px] leading-normal">
                Reset cache offline, sesi, blanko upload, dan setting.
              </p>
            </div>
            <button
              :class="ui.secondaryButton"
              :aria-expanded="showLocalDataOptions"
              aria-controls="local-data-options"
              @click="toggleLocalDataOptions"
            >
              {{ showLocalDataOptions ? 'Tutup Opsi Data' : 'Kelola Data Lokal' }}
            </button>
          </div>

          <div
            v-if="showLocalDataOptions"
            id="local-data-options"
            class="border-stc-border flex flex-col gap-3 border-t py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <p class="text-stc-text-soft text-[13px] leading-normal">
              Pakai ini hanya jika ingin mengulang aplikasi dari awal. Galeri dan cache offline ikut
              hilang.
            </p>
            <button
              :class="[ui.ghostButton, 'text-stc-error hover:bg-stc-error-soft']"
              @click="handleClearAllLocalData"
            >
              Bersihkan Semua Data Lokal
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
