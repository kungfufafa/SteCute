import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useCapabilityStore = defineStore('capability', () => {
  const canShare = ref(!!navigator.share)
  const canPrint = ref(typeof window !== 'undefined' && !!window.print)

  function detectCapabilities() {
    canShare.value = !!navigator.share
    canPrint.value = typeof window !== 'undefined' && !!window.print
  }

  return {
    canShare,
    canPrint,
    detectCapabilities,
  }
})
