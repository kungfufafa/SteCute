<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/app/store/useAppStore'
import { useCustomTemplateStore } from '@/app/store/useCustomTemplateStore'
import { useGalleryStore } from '@/app/store/useGalleryStore'
import { useSessionStore } from '@/app/store/useSessionStore'
import { downloadBlob, generateFilename, getExtensionForMimeType } from '@/services/output'
import { clearAllLocalData, getStorageState, type StorageState } from '@/services/storage'
import { formatBytes, formatDate } from '@/utils/format'
import { ui } from '@/ui/styles'

const router = useRouter()
const appStore = useAppStore()
const galleryStore = useGalleryStore()
const sessionStore = useSessionStore()
const customTemplateStore = useCustomTemplateStore()
const renderUrls = ref<Record<string, string>>({})
const liveUrls = ref<Record<string, string>>({})
const storageState = ref<StorageState | null>(null)
const localDataMessage = ref<string | null>(null)
const showLocalDataOptions = ref(false)

onMounted(() => {
  void loadGallery()
})

function goBack() {
  router.push('/')
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
  Object.values(liveUrls.value).forEach((url) => URL.revokeObjectURL(url))
  renderUrls.value = {}
  liveUrls.value = {}
}

async function loadGallery() {
  await galleryStore.loadRecent()
  storageState.value = await getStorageState()
  revokeRenderUrls()

  renderUrls.value = Object.fromEntries(
    galleryStore.recentRenders.map((render) => [render.id, URL.createObjectURL(render.blob)]),
  )
  liveUrls.value = Object.fromEntries(
    galleryStore.recentRenders
      .filter((render) => render.liveBlob)
      .map((render) => [render.id, URL.createObjectURL(render.liveBlob!)]),
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
      <span :class="ui.badge">{{ galleryStore.recentRenders.length }} item</span>
    </div>

    <div :class="ui.content">
      <div :class="[ui.pageContentWide, ui.stack]">
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

        <div v-if="galleryStore.recentRenders.length === 0" :class="[ui.emptyPanel, 'max-w-none']">
          <h4 class="text-stc-text text-[15px] font-medium">Belum Ada Hasil</h4>
          <p class="text-stc-text-soft mx-auto mt-1 max-w-sm text-[13px] leading-normal">
            Strip yang sudah dirender akan muncul di sini dan tetap tersedia saat offline.
          </p>
          <button :class="[ui.primaryButton, 'mt-4']" @click="router.push('/')">Mulai Foto</button>
        </div>

        <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="(render, index) in galleryStore.recentRenders"
            :key="render.id"
            class="border-stc-border overflow-hidden rounded-lg border bg-white"
          >
            <button
              class="bg-stc-bg-2 block w-full overflow-hidden"
              :style="{ aspectRatio: `${render.width} / ${render.height}` }"
              :aria-label="`Buka hasil ${index + 1}`"
              @click="openOutput(render.id)"
            >
              <img
                :src="renderUrls[render.id]"
                :alt="`Render ${index + 1}`"
                class="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </button>
            <div
              class="border-stc-border flex items-center justify-between gap-2 border-t px-3 py-2.5"
            >
              <div class="min-w-0">
                <div class="text-stc-text truncate text-[13px] font-medium">
                  {{ formatDate(render.createdAt) }}
                </div>
                <div class="text-stc-text-faint text-[13px]">
                  {{ formatBytes(render.sizeBytes) }}
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-1">
                <button
                  :class="ui.ghostButton"
                  :aria-label="`Unduh render ${index + 1}`"
                  @click="handleDownload(render.id)"
                >
                  Unduh
                </button>
                <button
                  :class="[
                    ui.ghostButton,
                    'text-stc-error hover:bg-stc-error-soft hover:text-stc-error',
                  ]"
                  :aria-label="`Hapus render ${index + 1}`"
                  @click="handleDelete(render.id)"
                >
                  Hapus
                </button>
              </div>
            </div>
            <div v-if="liveUrls[render.id]" class="border-stc-border border-t px-3 py-2">
              <button
                :class="[ui.ghostButton, 'w-full']"
                :aria-label="`Unduh Live Cam ${index + 1}`"
                @click="handleDownloadLive(render.id)"
              >
                Unduh Live Cam
              </button>
            </div>
          </div>
        </div>

        <div v-if="galleryStore.recentRenders.length > 0" class="flex justify-end">
          <button
            :class="[ui.ghostButton, 'text-stc-error hover:bg-stc-error-soft']"
            @click="handleClearAll"
          >
            Kosongkan Galeri
          </button>
        </div>

        <div class="border-stc-border divide-stc-border divide-y border-t">
          <div class="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="min-w-0">
              <p class="text-stc-text text-[13px] font-medium">Data lokal aplikasi</p>
              <p class="text-stc-text-soft mt-0.5 text-[13px] leading-normal">
                Opsi lanjutan untuk reset cache offline, sesi, blanko upload, dan setting.
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
            class="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
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
