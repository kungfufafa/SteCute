import { defineStore } from 'pinia'
import { ref } from 'vue'

export type PermissionState = 'prompt' | 'granted' | 'denied' | 'unavailable'
export type ActiveCameraFacingMode = 'user' | 'environment' | 'unknown'

export const useCameraStore = defineStore('camera', () => {
  const permissionState = ref<PermissionState>('prompt')
  const activeDeviceId = ref<string | null>(null)
  const activeDeviceLabel = ref('')
  const activeFacingMode = ref<ActiveCameraFacingMode>('unknown')
  const streamReady = ref(false)

  function setPermissionState(state: PermissionState) {
    permissionState.value = state
  }

  function setActiveDevice(
    deviceId: string | null,
    facingMode: ActiveCameraFacingMode = 'unknown',
    label = '',
  ) {
    activeDeviceId.value = deviceId
    activeFacingMode.value = facingMode
    activeDeviceLabel.value = label
  }

  function setStreamReady(ready: boolean) {
    streamReady.value = ready
  }

  function reset() {
    permissionState.value = 'prompt'
    activeDeviceId.value = null
    activeDeviceLabel.value = ''
    activeFacingMode.value = 'unknown'
    streamReady.value = false
  }

  return {
    permissionState,
    activeDeviceId,
    activeDeviceLabel,
    activeFacingMode,
    streamReady,
    setPermissionState,
    setActiveDevice,
    setStreamReady,
    reset,
  }
})
