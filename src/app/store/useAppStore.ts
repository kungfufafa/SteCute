import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ServiceWorkerStatus = 'unsupported' | 'idle' | 'registering' | 'ready' | 'update' | 'error'

export const useAppStore = defineStore('app', () => {
  const offlineMode = ref(!navigator.onLine)
  const offlineReady = ref(false)
  const serviceWorkerStatus = ref<ServiceWorkerStatus>(
    'serviceWorker' in navigator ? 'idle' : 'unsupported',
  )
  const serviceWorkerError = ref<string | null>(null)

  function setOfflineMode(offline: boolean) {
    offlineMode.value = offline
  }

  function setServiceWorkerRegistering() {
    serviceWorkerStatus.value = 'registering'
    serviceWorkerError.value = null
  }

  function setOfflineReady() {
    offlineReady.value = true
    serviceWorkerStatus.value = 'ready'
    serviceWorkerError.value = null
  }

  function setServiceWorkerUpdateAvailable() {
    serviceWorkerStatus.value = 'update'
  }

  function setServiceWorkerUnsupported() {
    offlineReady.value = false
    serviceWorkerStatus.value = 'unsupported'
  }

  function setServiceWorkerError(error: unknown) {
    serviceWorkerStatus.value = 'error'
    serviceWorkerError.value = error instanceof Error ? error.message : String(error)
  }

  function markOfflineCacheCleared() {
    offlineReady.value = false
    serviceWorkerStatus.value = 'idle'
  }

  return {
    offlineMode,
    offlineReady,
    serviceWorkerStatus,
    serviceWorkerError,
    setOfflineMode,
    setServiceWorkerRegistering,
    setOfflineReady,
    setServiceWorkerUpdateAvailable,
    setServiceWorkerUnsupported,
    setServiceWorkerError,
    markOfflineCacheCleared,
  }
})
