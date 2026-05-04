<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useAppStore, useCapabilityStore, useCustomTemplateStore } from '@/stores'

const appStore = useAppStore()
const capabilityStore = useCapabilityStore()
const customTemplateStore = useCustomTemplateStore()

function handleOnline() {
  appStore.setOfflineMode(false)
}

function handleOffline() {
  appStore.setOfflineMode(true)
}

onMounted(() => {
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  capabilityStore.detectCapabilities()
  void customTemplateStore.loadPersistedTemplates()
})

onUnmounted(() => {
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)
})
</script>

<template>
  <slot />
</template>
