<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterView } from 'vue-router'
import { useAppStore } from '@/app/store/useAppStore'
import OfflineBanner from '@/components/common/OfflineBanner.vue'
import ErrorBoundary from '@/components/common/ErrorBoundary.vue'
import UpdatePrompt from '@/components/common/UpdatePrompt.vue'

const updatePromptRef = ref<InstanceType<typeof UpdatePrompt> | null>(null)
const appStore = useAppStore()
let applyServiceWorkerUpdate: ((reloadPage?: boolean) => Promise<void>) | null = null

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    appStore.setServiceWorkerUnsupported()
    return
  }

  appStore.setServiceWorkerRegistering()

  try {
    const { registerSW } = await import('virtual:pwa-register')

    applyServiceWorkerUpdate = registerSW({
      immediate: true,
      onOfflineReady() {
        appStore.setOfflineReady()
      },
      onNeedRefresh() {
        appStore.setServiceWorkerUpdateAvailable()
        updatePromptRef.value?.promptUpdate(() => applyServiceWorkerUpdate?.(true))
      },
      onRegisteredSW(_, registration) {
        if (!registration) return

        void navigator.serviceWorker.ready
          .then(() => appStore.setOfflineReady())
          .catch((error) => appStore.setServiceWorkerError(error))
      },
      onRegisterError(error) {
        appStore.setServiceWorkerError(error)
      },
    })
  } catch (error) {
    appStore.setServiceWorkerError(error)
  }
}

onMounted(() => {
  void registerServiceWorker()
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
