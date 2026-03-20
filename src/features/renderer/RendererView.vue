<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createDecorationConfig, renderAndStoreSession } from '@/services/session'
import { getLayoutById } from '@/layouts'
import { getTemplateById } from '@/templates'
import { useCustomizeStore, useSessionStore } from '@/stores'

const router = useRouter()
const sessionStore = useSessionStore()
const customizeStore = useCustomizeStore()
const isRendering = ref(false)

onMounted(async () => {
  sessionStore.setRendering()
  const sessionId = sessionStore.sessionId
  const layout = getLayoutById(sessionStore.layoutId)
  const template = getTemplateById(sessionStore.templateId)

  if (!sessionId || !layout || !template) {
    sessionStore.setError('Session data is incomplete')
    router.push('/review')
    return
  }

  isRendering.value = true

  try {
    const renderId = await renderAndStoreSession({
      sessionId,
      layout,
      template,
      decoration: createDecorationConfig({
        filterId: customizeStore.activeFilterId,
        frameColor: customizeStore.frameColor,
        selectedStickerIds: customizeStore.selectedStickerIds,
        showDateTime: customizeStore.showDateTime,
        logoText: customizeStore.logoText,
      }),
      format: 'image/png',
    })

    isRendering.value = false
    sessionStore.setRenderId(renderId)
    sessionStore.setCompleted()
    router.push('/output')
  } catch (error) {
    console.error('Render failed:', error)
    isRendering.value = false
    sessionStore.setError('Gagal memproses foto. Silakan coba lagi.')
    router.push('/review')
  }
})
</script>

<template>
  <div
    class="mx-auto flex min-h-dvh w-full max-w-6xl items-center justify-center px-4 py-10 text-center sm:px-6 lg:px-10"
  >
    <div
      class="w-full max-w-md rounded-[32px] border border-stc-border bg-white/95 px-8 py-10 shadow-[0_24px_70px_rgba(26,26,46,0.14)]"
    >
      <div class="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-stc-pink-soft">
        <div class="size-10 animate-spin rounded-full border-4 border-transparent border-r-stc-pink/60 border-t-stc-pink"></div>
      </div>
      <h3 class="text-xl font-bold tracking-tight text-stc-text">Memproses...</h3>
      <p class="mt-2 text-sm leading-relaxed text-stc-text-soft">
        Menggabungkan foto ke template strip pilihan kamu.
      </p>
      <div class="mt-8 overflow-hidden rounded-full bg-stc-border">
        <div
          v-if="isRendering"
          class="h-2 w-1/3 animate-indeterminate-progress rounded-full bg-stc-pink"
        ></div>
        <div
          v-else
          class="h-2 w-full rounded-full bg-stc-success transition-[width] duration-300"
        ></div>
      </div>
      <p class="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-stc-text-faint">
        {{ isRendering ? 'Memproses...' : 'Selesai' }}
      </p>
    </div>
  </div>
</template>
