<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  createDefaultDecorationConfig,
  getReviewSessionSnapshot,
  renderAndStoreSession,
} from '@/services/session'
import { getLayoutById } from '@/layouts'
import { getTemplateById } from '@/templates'
import { useCustomTemplateStore } from '@/app/store/useCustomTemplateStore'
import { useSessionStore } from '@/app/store/useSessionStore'
import { getStorageErrorMessage, isStorageQuotaError } from '@/services/storage'
import { ui } from '@/ui/styles'
import FlowProgress from '@/components/common/FlowProgress.vue'

const router = useRouter()
const sessionStore = useSessionStore()
const customTemplateStore = useCustomTemplateStore()
const isRendering = ref(false)

onMounted(async () => {
  await customTemplateStore.loadPersistedTemplates()

  const snapshot = await getReviewSessionSnapshot(sessionStore.sessionId)

  if (snapshot) {
    sessionStore.restoreFromSession(snapshot.session, snapshot.shots)
  }

  sessionStore.setRendering()
  const sessionId = sessionStore.sessionId
  const layout =
    customTemplateStore.getLayoutById(sessionStore.layoutId) ?? getLayoutById(sessionStore.layoutId)
  const template =
    customTemplateStore.getTemplateById(sessionStore.templateId) ??
    getTemplateById(sessionStore.templateId)

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
    router.push({ path: '/output', query: { renderId } })
  } catch (error) {
    console.error('Render failed:', error)
    isRendering.value = false
    sessionStore.setError(
      isStorageQuotaError(error)
        ? getStorageErrorMessage(error)
        : 'Gagal memproses foto. Silakan coba lagi.',
    )
    router.push('/review')
  }
})
</script>

<template>
  <div :class="ui.page">
    <FlowProgress current="render" :source="sessionStore.captureSource" />

    <div class="m-auto flex w-full max-w-md flex-col px-4 py-10 sm:px-6">
      <div :class="[ui.panel, 'w-full px-8 py-12 text-center']">
        <div
          class="bg-stc-pink-soft text-stc-pink shadow-stc-xs mx-auto mb-6 flex size-16 items-center justify-center rounded-xl"
        >
          <div
            class="border-r-stc-pink/30 border-t-stc-pink size-10 animate-spin rounded-full border-[4px] border-transparent"
          ></div>
        </div>
        <h3 class="text-stc-text text-xl font-bold">Memproses Strip...</h3>
        <p class="text-stc-text-soft mt-2 text-[0.9375rem] leading-relaxed font-medium">
          Menggabungkan tangkapan kamu ke format akhir.
        </p>
        <div
          class="bg-stc-bg-3 border-stc-border/50 shadow-stc-xs relative mt-10 h-2.5 w-full overflow-hidden rounded-full border"
        >
          <div
            v-if="isRendering"
            class="animate-indeterminate-progress bg-stc-pink absolute top-0 left-0 h-full w-1/3 rounded-full"
          ></div>
          <div
            v-else
            class="bg-stc-success absolute top-0 left-0 h-full w-full rounded-full transition-all duration-300"
          ></div>
        </div>
        <p :class="[ui.sectionLabel, 'mt-4']">
          {{ isRendering ? 'Harap Tunggu' : 'Selesai' }}
        </p>
      </div>
    </div>
  </div>
</template>
