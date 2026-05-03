import { defineStore } from 'pinia'
import { ref } from 'vue'

export type PermissionState = 'prompt' | 'granted' | 'denied' | 'unavailable'

export const useCameraStore = defineStore('camera', () => {
  const permissionState = ref<PermissionState>('prompt')
  const activeDeviceId = ref<string | null>(null)
  const streamReady = ref(false)

  function setPermissionState(state: PermissionState) {
    permissionState.value = state
  }

  function setActiveDevice(deviceId: string | null) {
    activeDeviceId.value = deviceId
  }

  function setStreamReady(ready: boolean) {
    streamReady.value = ready
  }

  function reset() {
    permissionState.value = 'prompt'
    activeDeviceId.value = null
    streamReady.value = false
  }

  return {
    permissionState,
    activeDeviceId,
    streamReady,
    setPermissionState,
    setActiveDevice,
    setStreamReady,
    reset,
  }
})
