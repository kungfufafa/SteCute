import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const offlineMode = ref(!navigator.onLine)

  function setOfflineMode(offline: boolean) {
    offlineMode.value = offline
  }

  return {
    offlineMode,
    setOfflineMode,
  }
})
