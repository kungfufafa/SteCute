import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const appReady = ref(false)
  const offlineMode = ref(!navigator.onLine)
  const installPromptAvailable = ref(false)
  const swUpdateAvailable = ref(false)

  function setAppReady(ready: boolean) {
    appReady.value = ready
  }

  function setOfflineMode(offline: boolean) {
    offlineMode.value = offline
  }

  function setInstallPromptAvailable(available: boolean) {
    installPromptAvailable.value = available
  }

  function setSwUpdateAvailable(available: boolean) {
    swUpdateAvailable.value = available
  }

  return {
    appReady,
    offlineMode,
    installPromptAvailable,
    swUpdateAvailable,
    setAppReady,
    setOfflineMode,
    setInstallPromptAvailable,
    setSwUpdateAvailable,
  }
})
