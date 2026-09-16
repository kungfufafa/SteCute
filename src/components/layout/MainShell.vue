<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { useAppStore } from '@/app/store/useAppStore'
import { useSessionStore } from '@/app/store/useSessionStore'
import { shouldHoldPwaUpdate } from '@/services/pwa/update'
import OfflineBanner from '@/components/common/OfflineBanner.vue'
import ErrorBoundary from '@/components/common/ErrorBoundary.vue'
import UpdatePrompt from '@/components/common/UpdatePrompt.vue'

const updatePromptRef = ref<InstanceType<typeof UpdatePrompt> | null>(null)
const appStore = useAppStore()
const sessionStore = useSessionStore()
const route = useRoute()
let applyServiceWorkerUpdate: ((reloadPage?: boolean) => Promise<void>) | null = null
let pendingUpdateAction: (() => Promise<void> | void) | null = null
let updatePromptOffered = false

function maybePromptUpdate() {
  if (!pendingUpdateAction || updatePromptOffered) return
  if (shouldHoldPwaUpdate(route.path, sessionStore.sessionStatus)) return

  updatePromptOffered = true
  updatePromptRef.value?.promptUpdate(pendingUpdateAction)
}

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
        pendingUpdateAction = () => applyServiceWorkerUpdate?.(true)
        appStore.setServiceWorkerUpdateAvailable()
        maybePromptUpdate()
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

watch(
  () => [route.path, sessionStore.sessionStatus] as const,
  () => {
    maybePromptUpdate()
  },
)

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
