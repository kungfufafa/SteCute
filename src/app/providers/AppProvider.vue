<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useAppStore } from '@/app/store/useAppStore'
import { useCapabilityStore } from '@/app/store/useCapabilityStore'

const appStore = useAppStore()
const capabilityStore = useCapabilityStore()

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
})

onUnmounted(() => {
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)
})
</script>

<template>
  <slot />
</template>
