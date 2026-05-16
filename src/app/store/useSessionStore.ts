import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Session, Shot } from '@/db/schema'
import { normalizeCameraEffectId } from '@/services/camera-effects'

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
  const autoCapture = ref<boolean>(false)
  const countdownSeconds = ref<number>(3)
  const filterId = ref<string>('normal')
  const cameraEffectId = ref<string>('none')
  const slotCount = ref<number>(3)
  const currentShotIndex = ref<number>(0)
  const shotIds = ref<string[]>([])
  const renderId = ref<string | null>(null)
  const errorMessage = ref<string | null>(null)

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

  function restoreFromSession(session: Session, shots: Shot[] = []) {
    const shotIdByOrder = new Map(shots.map((shot) => [shot.order, shot.id]))
    const firstMissingOrder = Array.from({ length: session.slotCount }, (_, index) => index).find(
      (order) => !shotIdByOrder.has(order),
    )

    sessionId.value = session.id
    captureSource.value = session.captureSource
    layoutId.value = session.layoutId
    templateId.value = session.templateId
    filterId.value = session.decorationConfig.filterId || 'normal'
    cameraEffectId.value = normalizeCameraEffectId(session.decorationConfig.cameraEffectId)
    slotCount.value = session.slotCount
    currentShotIndex.value = firstMissingOrder ?? Math.max(0, session.slotCount - 1)
    shotIds.value = Array.from(
      { length: session.slotCount },
      (_, index) => shotIdByOrder.get(index) ?? '',
    )
    renderId.value = session.finalRenderId
    errorMessage.value = null

    if (session.finalRenderId || session.status === 'completed') {
      sessionStatus.value = 'completed'
      return
    }

    sessionStatus.value =
      shots.length >= session.slotCount
        ? 'reviewing'
        : session.captureSource === 'camera'
          ? 'capturing'
          : 'uploading'
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

  function setFilterId(id: string) {
    filterId.value = id
  }

  function setCameraEffectId(id: string) {
    cameraEffectId.value = normalizeCameraEffectId(id)
  }

  function reset() {
    sessionId.value = null
    sessionStatus.value = 'idle'
    captureSource.value = null
    currentShotIndex.value = 0
    shotIds.value = []
    renderId.value = null
    errorMessage.value = null
    filterId.value = 'normal'
    cameraEffectId.value = 'none'
  }

  return {
    sessionId,
    sessionStatus,
    captureSource,
    layoutId,
    templateId,
    autoCapture,
    countdownSeconds,
    filterId,
    cameraEffectId,
    slotCount,
    currentShotIndex,
    shotIds,
    renderId,
    errorMessage,
    startSession,
    restoreFromSession,
    setCapturing,
    setReviewing,
    setRendering,
    setCompleted,
    setError,
    advanceShot,
    addShotId,
    replaceShotId,
    setRenderId,
    setFilterId,
    setCameraEffectId,
    reset,
  }
})
