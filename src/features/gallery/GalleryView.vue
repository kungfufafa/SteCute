<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/app/store/useAppStore'
import { useGalleryStore } from '@/app/store/useGalleryStore'
import { useSessionStore } from '@/app/store/useSessionStore'
import { downloadBlob, generateFilename } from '@/services/output'
import { clearAllLocalData, getStorageState, type StorageState } from '@/services/storage'
import { formatBytes, formatDate } from '@/utils/format'
import { ui } from '@/ui/styles'

const router = useRouter()
const appStore = useAppStore()
const galleryStore = useGalleryStore()
const sessionStore = useSessionStore()
const renderUrls = ref<Record<string, string>>({})
const storageState = ref<StorageState | null>(null)
const localDataMessage = ref<string | null>(null)

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
  if (confirm('Hapus semua photo strip tersimpan? Tindakan ini tidak bisa dibatalkan.')) {
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
    'Hapus semua data lokal Stecute? Gallery, sesi, blanko upload, setting, dan cache offline akan dibersihkan. Aplikasi perlu internet lagi untuk cache ulang.',
  )

  if (!confirmed) return

  try {
    await clearAllLocalData()
    sessionStore.reset()
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

async function handleDownload(renderId: string) {
  const render = galleryStore.recentRenders.find((item) => item.id === renderId)
  if (!render) return

  const extension = render.mimeType === 'image/jpeg' ? 'jpg' : 'png'
  const filename = generateFilename('gallery', 'saved', extension)
  await downloadBlob(render.blob, filename)
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
          <h3 :class="ui.title">Galeri</h3>
          <p :class="ui.subtitle">10 hasil render terakhir tersimpan lokal.</p>
        </div>
      </div>
      <span :class="ui.badge">{{ galleryStore.recentRenders.length }} item</span>
    </div>

    <div :class="ui.content">
      <div :class="[ui.pageContentWide, 'gap-8']">
        <div
          v-if="storageState?.shouldWarn || localDataMessage"
          class="border-stc-warning/30 bg-stc-warning-soft text-stc-text shadow-stc-xs rounded-xl border px-4 py-3 text-sm font-semibold"
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

        <div v-if="galleryStore.recentRenders.length === 0" :class="ui.emptyPanel">
          <div :class="ui.surfaceIcon">
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
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
          <h4 class="text-stc-text text-xl font-bold">Belum Ada Hasil</h4>
          <p
            class="text-stc-text-soft mx-auto mt-3 max-w-sm text-[0.9375rem] leading-relaxed font-medium"
          >
            Strip yang sudah dirender akan muncul di sini dan tetap tersedia saat offline.
          </p>
          <button :class="[ui.primaryButton, 'mt-8 sm:min-w-56']" @click="router.push('/')">
            Mulai Foto
          </button>
        </div>

        <div v-else class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="(render, index) in galleryStore.recentRenders"
            :key="render.id"
            class="group border-stc-border/80 shadow-stc-sm hover:shadow-stc-md overflow-hidden rounded-xl border bg-white transition-all duration-300 hover:-translate-y-1"
          >
            <div
              class="bg-stc-bg-2 overflow-hidden"
              :style="{ aspectRatio: `${render.width} / ${render.height}` }"
            >
              <img
                :src="renderUrls[render.id]"
                :alt="`Render ${index + 1}`"
                class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <div class="border-stc-border relative z-10 space-y-4 border-t bg-white px-5 py-4">
              <div>
                <div class="text-stc-text-faint text-[0.6875rem] font-bold uppercase">
                  {{ formatDate(render.createdAt) }}
                </div>
                <div class="text-stc-text-soft mt-1.5 text-[0.9375rem] font-medium">
                  {{ formatBytes(render.sizeBytes) }}
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <button
                  class="border-stc-border text-stc-text shadow-stc-xs hover:border-stc-border-strong hover:bg-stc-bg-2 focus-visible:ring-stc-pink inline-flex min-h-11 items-center justify-center rounded-xl border bg-white px-3 py-2 text-xs font-bold transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-95"
                  :aria-label="`Download render ${index + 1}`"
                  @click="handleDownload(render.id)"
                >
                  Download
                </button>
                <button
                  class="bg-stc-error shadow-stc-xs hover:bg-stc-error-strong focus-visible:ring-stc-error inline-flex min-h-11 items-center justify-center rounded-xl px-3 py-2 text-xs font-bold text-white transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-95"
                  :aria-label="`Hapus render ${index + 1}`"
                  @click="handleDelete(render.id)"
                >
                  Hapus
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="galleryStore.recentRenders.length > 0" :class="ui.bottomActions">
          <button
            :class="[
              ui.secondaryButton,
              'text-stc-error hover:bg-stc-error-soft border-stc-error/20 hover:border-stc-error/40 w-full sm:ml-auto sm:w-auto sm:min-w-48',
            ]"
            @click="handleClearAll"
          >
            Hapus Semua
          </button>
        </div>

        <div
          class="border-stc-border/70 bg-white shadow-stc-xs rounded-xl border px-4 py-4 sm:flex sm:items-center sm:justify-between sm:gap-4"
        >
          <div class="min-w-0">
            <p class="text-stc-text text-sm font-bold">Data lokal aplikasi</p>
            <p class="text-stc-text-soft mt-1 text-xs leading-relaxed font-medium">
              Bersihkan gallery, sesi, blanko upload, setting, dan cache offline yang bisa dihapus
              aplikasi.
            </p>
          </div>
          <button
            class="border-stc-error/30 text-stc-error hover:bg-stc-error-soft focus-visible:ring-stc-error mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl border bg-white px-4 py-2.5 text-sm font-bold transition-all outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98] sm:mt-0 sm:w-auto sm:shrink-0"
            @click="handleClearAllLocalData"
          >
            Hapus Semua Data
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
