import { defineStore } from 'pinia'
import { ref } from 'vue'

export type PermissionState = 'prompt' | 'granted' | 'denied' | 'unavailable'

export const useCameraStore = defineStore('camera', () => {
  const permissionState = ref<PermissionState>('prompt')
  const activeDeviceId = ref<string | null>(null)
  const availableDevices = ref<MediaDeviceInfo[]>([])
  const streamReady = ref(false)
  const previewAspectRatio = ref('4/3')

  function setPermissionState(state: PermissionState) {
    permissionState.value = state
  }

  function setActiveDevice(deviceId: string | null) {
    activeDeviceId.value = deviceId
  }

  function setAvailableDevices(devices: MediaDeviceInfo[]) {
    availableDevices.value = devices
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
    availableDevices,
    streamReady,
    previewAspectRatio,
    setPermissionState,
    setActiveDevice,
    setAvailableDevices,
    setStreamReady,
    reset,
  }
})
