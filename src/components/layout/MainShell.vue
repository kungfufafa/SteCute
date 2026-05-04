<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterView } from 'vue-router'
import OfflineBanner from '@/components/common/OfflineBanner.vue'
import ErrorBoundary from '@/components/common/ErrorBoundary.vue'
import UpdatePrompt from '@/components/common/UpdatePrompt.vue'

const updatePromptRef = ref<InstanceType<typeof UpdatePrompt> | null>(null)

function scheduleServiceWorkerRegistration() {
  globalThis.setTimeout(() => {
    void import('virtual:pwa-register').then(({ registerSW }) => {
      registerSW({
        onNeedRefresh() {
          updatePromptRef.value?.promptUpdate()
        },
      })
    })
  }, 4000)
}

onMounted(() => {
  scheduleServiceWorkerRegistration()
})
</script>

<template>
  <ErrorBoundary>
    <OfflineBanner />
    <UpdatePrompt ref="updatePromptRef" />
    <div class="bg-stc-bg text-stc-text min-h-dvh">
      <RouterView />
    </div>
  </ErrorBoundary>
</template>
