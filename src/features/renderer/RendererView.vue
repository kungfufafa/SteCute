<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createDefaultDecorationConfig, renderAndStoreSession } from '@/services/session'
import { getLayoutById } from '@/layouts'
import { getTemplateById } from '@/templates'
import { useSessionStore } from '@/stores'

const router = useRouter()
const sessionStore = useSessionStore()
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
      decoration: createDefaultDecorationConfig(template),
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
      class="border-stc-border shadow-stc-sm w-full max-w-md rounded-2xl border bg-white px-8 py-10"
    >
      <div
        class="bg-stc-pink-soft mx-auto mb-5 flex size-16 items-center justify-center rounded-full"
      >
        <div
          class="border-r-stc-pink/60 border-t-stc-pink size-10 animate-spin rounded-full border-4 border-transparent"
        ></div>
      </div>
      <h3 class="text-stc-text text-xl font-bold tracking-tight">Memproses...</h3>
      <p class="text-stc-text-soft mt-2 text-sm leading-relaxed">
        Menggabungkan foto ke strip final.
      </p>
      <div class="bg-stc-border mt-8 overflow-hidden rounded-full">
        <div
          v-if="isRendering"
          class="animate-indeterminate-progress bg-stc-pink h-2 w-1/3 rounded-full"
        ></div>
        <div
          v-else
          class="bg-stc-success h-2 w-full rounded-full transition-[width] duration-150"
        ></div>
      </div>
      <p class="text-stc-text-faint mt-3 text-xs font-semibold tracking-[0.16em] uppercase">
        {{ isRendering ? 'Memproses...' : 'Selesai' }}
      </p>
    </div>
  </div>
</template>
