import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type SessionStatus =
  | 'idle'
  | 'ready'
  | 'configuring'
  | 'capturing'
  | 'uploading'
  | 'reviewing'
  | 'rendering'
  | 'completed'
  | 'error'

export const useSessionStore = defineStore('session', () => {
  const sessionId = ref<string | null>(null)
  const sessionStatus = ref<SessionStatus>('idle')
  const captureSource = ref<'camera' | 'upload' | null>(null)
  const layoutId = ref<string>('strip-3-vertical')
  const templateId = ref<string>('classic')
  const countdownSeconds = ref<number>(3)
  const slotCount = ref<number>(3)
  const currentShotIndex = ref<number>(0)
  const shotIds = ref<string[]>([])
  const renderId = ref<string | null>(null)
  const errorMessage = ref<string | null>(null)

  const isCapturing = computed(() => sessionStatus.value === 'capturing')
  const isReviewing = computed(() => sessionStatus.value === 'reviewing')
  const isRendering = computed(() => sessionStatus.value === 'rendering')
  const isCompleted = computed(() => sessionStatus.value === 'completed')

  function startSession(id: string, source: 'camera' | 'upload', slots: number) {
    sessionId.value = id
    captureSource.value = source
    slotCount.value = slots
    currentShotIndex.value = 0
    shotIds.value = []
    renderId.value = null
    errorMessage.value = null
    sessionStatus.value = source === 'camera' ? 'capturing' : 'uploading'
  }

  function setConfiguring() {
    sessionStatus.value = 'configuring'
  }

  function setCapturing() {
    sessionStatus.value = 'capturing'
  }

  function setReviewing() {
    sessionStatus.value = 'reviewing'
  }

  function setRendering() {
    sessionStatus.value = 'rendering'
  }

  function setCompleted() {
    sessionStatus.value = 'completed'
  }

  function setError(message: string) {
    sessionStatus.value = 'error'
    errorMessage.value = message
  }

  function advanceShot() {
    currentShotIndex.value++
  }

  function addShotId(id: string) {
    shotIds.value.push(id)
  }

  function replaceShotId(index: number, id: string) {
    shotIds.value[index] = id
  }

  function setRenderId(id: string) {
    renderId.value = id
  }

  function reset() {
    sessionId.value = null
    sessionStatus.value = 'idle'
    captureSource.value = null
    currentShotIndex.value = 0
    shotIds.value = []
    renderId.value = null
    errorMessage.value = null
  }

  return {
    sessionId,
    sessionStatus,
    captureSource,
    layoutId,
    templateId,
    countdownSeconds,
    slotCount,
    currentShotIndex,
    shotIds,
    renderId,
    errorMessage,
    isCapturing,
    isReviewing,
    isRendering,
    isCompleted,
    startSession,
    setConfiguring,
    setCapturing,
    setReviewing,
    setRendering,
    setCompleted,
    setError,
    advanceShot,
    addShotId,
    replaceShotId,
    setRenderId,
    reset,
  }
})
