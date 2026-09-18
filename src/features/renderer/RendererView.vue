<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  createDefaultDecorationConfig,
  getReviewSessionSnapshot,
  isSessionComplete,
  renderSessionForOutput,
} from '@/services/session'
import { getLayoutById } from '@/layouts'
import { getTemplateById } from '@/templates'
import { useCustomTemplateStore } from '@/app/store/useCustomTemplateStore'
import { useSessionStore } from '@/app/store/useSessionStore'
import { getStorageErrorMessage, isStorageQuotaError } from '@/services/storage'
import { readStoredSessionId } from '@/services/session/persist'
import { rememberSessionOutput } from '@/services/session/output-cache'
import { ui } from '@/ui/styles'
import FlowProgress from '@/components/common/FlowProgress.vue'

const router = useRouter()
const sessionStore = useSessionStore()
const customTemplateStore = useCustomTemplateStore()
const isRendering = ref(false)

let disposed = false
const renderAbort = new AbortController()
onBeforeUnmount(() => {
  disposed = true
  renderAbort.abort()
})

onMounted(async () => {
  const requestedSessionId = sessionStore.sessionId ?? readStoredSessionId()
  const ownsSession = () =>
    !disposed && (sessionStore.sessionId ?? readStoredSessionId()) === requestedSessionId

  try {
    await customTemplateStore.loadPersistedTemplates()
    if (!ownsSession()) return
    const snapshot = await getReviewSessionSnapshot(requestedSessionId)
    if (!ownsSession()) return

    if (snapshot) sessionStore.restoreFromSession(snapshot.session, snapshot.shots)

    if (snapshot?.session.finalRenderId) {
      sessionStore.setRenderId(snapshot.session.finalRenderId)
      sessionStore.setCompleted()
      await router.replace({ path: '/output', query: { renderId: snapshot.session.finalRenderId } })
      return
    }

    const layout =
      customTemplateStore.getLayoutById(sessionStore.layoutId) ??
      getLayoutById(sessionStore.layoutId)
    const template =
      customTemplateStore.getTemplateById(sessionStore.templateId) ??
      getTemplateById(sessionStore.templateId)

    if (
      !requestedSessionId ||
      !layout ||
      !template ||
      !snapshot ||
      !isSessionComplete(snapshot.shots, snapshot.session.slotCount)
    ) {
      sessionStore.setError('Foto sesi belum lengkap. Muat ulang atau mulai sesi baru.')
      await router.replace('/review')
      return
    }

    const decoration =
      snapshot.session.decorationConfig ??
      createDefaultDecorationConfig(template, {
        filterId: sessionStore.filterId,
        cameraEffectId: sessionStore.cameraEffectId,
      })
    sessionStore.setRendering()
    isRendering.value = true
    const output = await renderSessionForOutput({
      sessionId: requestedSessionId,
      layout,
      template,
      decoration,
      format: 'image/png',
      signal: renderAbort.signal,
    })

    // Navigation also cancels persistence and source cleanup for this render job.
    if (!ownsSession()) return
    rememberSessionOutput(output)
    sessionStore.setRenderId(output.render.id)
    sessionStore.setCompleted()
    await router.replace({ path: '/output', query: { renderId: output.render.id } })
  } catch (error) {
    if (!ownsSession()) return
    console.error('Render failed:', error)
    sessionStore.setError(
      isStorageQuotaError(error)
        ? getStorageErrorMessage(error)
        : 'Gagal memproses foto. Silakan coba lagi.',
    )
    await router.push('/review')
  } finally {
    if (!disposed) isRendering.value = false
  }
})
</script>

<template>
  <div :class="ui.page">
    <FlowProgress current="render" :source="sessionStore.captureSource" />

    <div class="m-auto flex w-full max-w-sm flex-col px-4 py-10 sm:px-5">
      <div :class="[ui.panel, 'w-full px-5 py-8 text-center']">
        <div
          class="border-stc-border border-t-stc-pink mx-auto mb-3 size-6 animate-spin rounded-full border-2"
        ></div>
        <h3 class="text-stc-text text-[15px] font-medium">Memproses Strip...</h3>
        <p class="text-stc-text-soft mt-1 text-[13px] leading-normal">
          Menggabungkan tangkapan kamu ke format akhir.
        </p>
        <div class="bg-stc-bg-3 relative mt-6 h-1 w-full overflow-hidden rounded-full">
          <div
            v-if="isRendering"
            class="animate-indeterminate-progress bg-stc-pink absolute top-0 left-0 h-full w-1/3 rounded-full"
          ></div>
          <div v-else class="bg-stc-success absolute top-0 left-0 h-full w-full rounded-full"></div>
        </div>
        <p :class="[ui.sectionLabel, 'mt-3']">
          {{ isRendering ? 'Harap Tunggu' : 'Selesai' }}
        </p>
      </div>
    </div>
  </div>
</template>
