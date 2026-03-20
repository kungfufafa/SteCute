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
  if (confirm('Delete this photo strip?')) {
    void removeAndReload(id)
  }
}

function handleClearAll() {
  if (confirm('Delete all saved photo strips? This cannot be undone.')) {
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
        <button :class="ui.iconButton" @click="goBack">
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
          class="mx-auto w-full max-w-xl rounded-[32px] border border-stc-border bg-white px-8 py-12 text-center shadow-[0_24px_70px_rgba(26,26,46,0.12)]"
        >
          <div
            class="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-stc-pink-soft text-2xl text-stc-pink"
          >
            □
          </div>
          <h4 class="text-xl font-bold tracking-tight text-stc-text">Belum Ada Hasil</h4>
          <p class="mt-3 text-sm leading-relaxed text-stc-text-soft">
            Strip yang sudah dirender akan muncul di sini dan tetap tersedia saat offline.
          </p>
          <button :class="[ui.primaryButton, 'mt-6 w-full sm:w-auto sm:min-w-56']" @click="router.push('/')">
            Mulai Foto
          </button>
        </div>

        <div
          v-else
          class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <div
            v-for="(render, index) in galleryStore.recentRenders"
            :key="render.id"
            :class="[
              'group relative overflow-hidden rounded-[28px] border border-stc-border bg-white shadow-stc-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_22px_44px_rgba(26,26,46,0.14)]',
              index % 3 === 1 ? 'sm:col-span-2 lg:col-span-1' : '',
            ]"
          >
            <div class="aspect-[2/3] overflow-hidden bg-stc-bg-2">
              <img
                :src="renderUrls[render.id]"
                :alt="`Render ${index + 1}`"
                class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            </div>
            <div class="border-t border-stc-border bg-white px-4 py-3">
              <div class="text-xs font-semibold uppercase tracking-[0.16em] text-stc-text-faint">
                {{ formatDate(render.createdAt) }}
              </div>
              <div class="mt-1 text-sm text-stc-text-soft">{{ formatBytes(render.sizeBytes) }}</div>
            </div>
            <div
              class="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-gradient-to-t from-black/50 to-transparent px-4 pb-4 pt-8 transition-opacity duration-200 md:opacity-0 md:group-hover:opacity-100"
            >
              <button
                class="inline-flex min-h-10 items-center justify-center rounded-full bg-white px-4 py-2 text-xs font-semibold text-stc-text shadow-stc-sm transition-all duration-200 hover:-translate-y-0.5"
                @click="handleDownload(render.id)"
              >
                Download
              </button>
              <button
                class="inline-flex min-h-10 items-center justify-center rounded-full bg-stc-error px-4 py-2 text-xs font-semibold text-white shadow-[0_10px_24px_rgba(239,68,68,0.24)] transition-all duration-200 hover:-translate-y-0.5"
                @click="handleDelete(render.id)"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>

        <div v-if="galleryStore.recentRenders.length > 0" class="mt-auto pb-2">
          <button
            :class="[ui.secondaryButton, 'w-full text-stc-error hover:bg-stc-error-soft sm:w-auto sm:min-w-48']"
            @click="handleClearAll"
          >
            Hapus Semua
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
