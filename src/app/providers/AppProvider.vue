<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useAppStore } from '@/app/store/useAppStore'
import { useCapabilityStore } from '@/app/store/useCapabilityStore'
import { useCustomTemplateStore } from '@/app/store/useCustomTemplateStore'
import { bindPwaInstallPrompt, subscribePwaInstallState } from '@/services/pwa/install'

const appStore = useAppStore()
const capabilityStore = useCapabilityStore()
const customTemplateStore = useCustomTemplateStore()
let unbindPwaInstallPrompt: (() => void) | null = null
let unsubscribePwaInstallState: (() => void) | null = null

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
  unsubscribePwaInstallState = subscribePwaInstallState(appStore.setPwaInstallState)
  unbindPwaInstallPrompt = bindPwaInstallPrompt()
})

onUnmounted(() => {
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)
  unbindPwaInstallPrompt?.()
  unsubscribePwaInstallState?.()
  unbindPwaInstallPrompt = null
  unsubscribePwaInstallState = null
})
</script>

<template>
  <slot />
</template>
