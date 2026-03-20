import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useCapabilityStore = defineStore('capability', () => {
  const canShare = ref(!!navigator.share)
  const canPrint = ref(typeof window !== 'undefined' && !!window.print)
  const canSaveFile = ref('showSaveFilePicker' in window)
  const canUseOffscreenCanvas = ref(typeof OffscreenCanvas !== 'undefined')
  const canUseImageBitmap = ref(typeof createImageBitmap !== 'undefined')
  const supportedInputModes = ref<string[]>([])

  function detectCapabilities() {
    supportedInputModes.value = []
    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      supportedInputModes.value.push('camera')
    }
    supportedInputModes.value.push('upload')

    canShare.value = !!navigator.share
    canPrint.value = typeof window !== 'undefined' && !!window.print
    canSaveFile.value = 'showSaveFilePicker' in window
    canUseOffscreenCanvas.value = typeof OffscreenCanvas !== 'undefined'
    canUseImageBitmap.value = typeof createImageBitmap !== 'undefined'
  }

  return {
    canShare,
    canPrint,
    canSaveFile,
    canUseOffscreenCanvas,
    canUseImageBitmap,
    supportedInputModes,
    detectCapabilities,
  }
})
