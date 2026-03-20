<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useAppStore, useCapabilityStore } from '@/stores'

const appStore = useAppStore()
const capabilityStore = useCapabilityStore()

function handleOnline() {
  appStore.setOfflineMode(false)
}

function handleOffline() {
  appStore.setOfflineMode(true)
}

function handleBeforeInstallPrompt(e: Event) {
  e.preventDefault()
  appStore.setInstallPromptAvailable(true)
}

onMounted(() => {
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  capabilityStore.detectCapabilities()
  appStore.setAppReady(true)
})

onUnmounted(() => {
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)
  window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
})
</script>

<template>
  <slot />
</template>
