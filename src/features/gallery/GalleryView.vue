<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGalleryStore } from '@/stores'
import { downloadBlob, generateFilename } from '@/services/output'
import { formatBytes, formatDate } from '@/utils/format'
import { ui } from '@/ui/styles'

const router = useRouter()
const galleryStore = useGalleryStore()
const renderUrls = ref<Record<string, string>>({})

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
    <div :class="ui.header">
      <div :class="ui.headerGroup">
        <button :class="ui.iconButton" aria-label="Kembali ke beranda" @click="goBack">
          <svg
            width="18"
            height="18"
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
        <div class="min-w-0">
          <h3 :class="ui.title">Galeri</h3>
          <p :class="ui.subtitle">10 hasil render terakhir tersimpan lokal di perangkat ini.</p>
        </div>
      </div>
      <span :class="ui.badge">{{ galleryStore.recentRenders.length }} item</span>
    </div>

    <div :class="ui.content">
      <div :class="[ui.contentWrap, 'gap-6']">
        <div
          v-if="galleryStore.recentRenders.length === 0"
          class="border-stc-border shadow-stc-xs mx-auto w-full max-w-xl rounded-2xl border bg-white px-8 py-12 text-center"
        >
          <div
            class="bg-stc-pink-soft text-stc-pink mx-auto mb-5 flex size-16 items-center justify-center rounded-full text-2xl"
          >
            □
          </div>
          <h4 class="text-stc-text text-xl font-bold tracking-tight">Belum Ada Hasil</h4>
          <p class="text-stc-text-soft mt-3 text-sm leading-relaxed">
            Strip yang sudah dirender akan muncul di sini dan tetap tersedia saat offline.
          </p>
          <button
            :class="[ui.primaryButton, 'mt-6 w-full sm:w-auto sm:min-w-56']"
            @click="router.push('/')"
          >
            Mulai Foto
          </button>
        </div>

        <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="(render, index) in galleryStore.recentRenders"
            :key="render.id"
            :class="[
              'group border-stc-border shadow-stc-xs overflow-hidden rounded-xl border bg-white',
              index % 3 === 1 ? 'sm:col-span-2 lg:col-span-1' : '',
            ]"
          >
            <div
              class="bg-stc-bg-2 overflow-hidden"
              :style="{ aspectRatio: `${render.width} / ${render.height}` }"
            >
              <img
                :src="renderUrls[render.id]"
                :alt="`Render ${index + 1}`"
                class="h-full w-full object-cover"
              />
            </div>
            <div class="border-stc-border space-y-3 border-t bg-white px-4 py-3">
              <div>
                <div class="text-stc-text-faint text-xs font-semibold tracking-[0.16em] uppercase">
                  {{ formatDate(render.createdAt) }}
                </div>
                <div class="text-stc-text-soft mt-1 text-sm">
                  {{ formatBytes(render.sizeBytes) }}
                </div>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <button
                  class="border-stc-border text-stc-text shadow-stc-xs hover:bg-stc-bg-2 inline-flex min-h-10 items-center justify-center rounded-xl border bg-white px-3 py-2 text-xs font-semibold transition-colors duration-150"
                  :aria-label="`Download render ${index + 1}`"
                  @click="handleDownload(render.id)"
                >
                  Download
                </button>
                <button
                  class="bg-stc-error shadow-stc-xs hover:bg-stc-error-strong inline-flex min-h-10 items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold text-white transition-colors duration-150"
                  :aria-label="`Hapus render ${index + 1}`"
                  @click="handleDelete(render.id)"
                >
                  Hapus
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="galleryStore.recentRenders.length > 0" class="mt-auto pb-2">
          <button
            :class="[
              ui.secondaryButton,
              'text-stc-error hover:bg-stc-error-soft w-full sm:w-auto sm:min-w-48',
            ]"
            @click="handleClearAll"
          >
            Hapus Semua
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
