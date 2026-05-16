<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  drawCameraEffect,
  normalizeCameraEffectId,
  isFaceTrackingEffect,
  drawFaceTrackingEffect,
  normalizeCameraEffectFrameMs,
  preloadCameraEffectAssets,
  resolveFaceTrackingEffectFaces,
} from '@/services/camera-effects'

import type { FaceBounds } from '@/services/face-tracking'

const props = withDefaults(
  defineProps<{
    effectId?: string
    faceBounds?: FaceBounds[]
    fallbackFaceBounds?: boolean
    frameMs?: number
    animated?: boolean
  }>(),
  {
    effectId: 'none',
    faceBounds: () => [],
    fallbackFaceBounds: false,
    frameMs: 0,
    animated: false,
  },
)

const emit = defineEmits<{
  frame: [frameMs: number]
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const prefersReducedMotion = ref(false)
let resizeObserver: InstanceType<typeof window.ResizeObserver> | null = null
let motionQuery: ReturnType<typeof window.matchMedia> | null = null
let animationFrameId: number | null = null

const normalizedEffectId = computed(() => normalizeCameraEffectId(props.effectId))
const shouldAnimate = computed(
  () => props.animated && normalizedEffectId.value !== 'none' && !prefersReducedMotion.value,
)

function getStaticFrameMs() {
  return normalizeCameraEffectFrameMs(props.frameMs ?? 0, normalizedEffectId.value)
}

function getLiveFrameMs() {
  return normalizeCameraEffectFrameMs(window.performance.now(), normalizedEffectId.value)
}

function renderEffect(frameMs = shouldAnimate.value ? getLiveFrameMs() : getStaticFrameMs()) {
  const canvas = canvasRef.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return

  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
  const nextWidth = Math.max(1, Math.round(rect.width * pixelRatio))
  const nextHeight = Math.max(1, Math.round(rect.height * pixelRatio))

  if (canvas.width !== nextWidth) canvas.width = nextWidth
  if (canvas.height !== nextHeight) canvas.height = nextHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  ctx.clearRect(0, 0, rect.width, rect.height)

  const effectId = normalizedEffectId.value
  if (isFaceTrackingEffect(effectId)) {
    const faces = resolveFaceTrackingEffectFaces(
      props.faceBounds,
      props.fallbackFaceBounds ? { width: rect.width, height: rect.height } : undefined,
    )
    drawFaceTrackingEffect(ctx, rect.width, rect.height, effectId, faces, { timeMs: frameMs })
  } else {
    drawCameraEffect(ctx, rect.width, rect.height, effectId, { timeMs: frameMs })
  }

  emit('frame', frameMs)
}

function stopAnimation() {
  if (animationFrameId !== null) {
    window.cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
}

function startAnimation() {
  stopAnimation()
  if (!shouldAnimate.value) return

  const tick = () => {
    renderEffect(getLiveFrameMs())
    animationFrameId = window.requestAnimationFrame(tick)
  }

  tick()
}

async function preloadAndRenderEffect() {
  await preloadCameraEffectAssets(normalizedEffectId.value)
  await nextTick()
  renderEffect()
}

function syncMotionPreference() {
  prefersReducedMotion.value = motionQuery?.matches ?? false
}

watch(
  [normalizedEffectId, () => props.frameMs, () => props.faceBounds, () => props.fallbackFaceBounds],
  () => {
    void nextTick(renderEffect)
  },
  { flush: 'post' },
)

watch(normalizedEffectId, () => {
  void preloadAndRenderEffect()
})

watch(shouldAnimate, () => {
  if (shouldAnimate.value) {
    startAnimation()
    return
  }

  stopAnimation()
  void nextTick(renderEffect)
})

onMounted(() => {
  if (typeof window.matchMedia === 'function') {
    motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    syncMotionPreference()
    motionQuery.addEventListener?.('change', syncMotionPreference)
  }

  renderEffect()
  void preloadAndRenderEffect()
  startAnimation()

  if (typeof window.ResizeObserver === 'undefined' || !canvasRef.value) return

  resizeObserver = new window.ResizeObserver(() => renderEffect())
  resizeObserver.observe(canvasRef.value)
})

onBeforeUnmount(() => {
  stopAnimation()
  resizeObserver?.disconnect()
  resizeObserver = null
  motionQuery?.removeEventListener?.('change', syncMotionPreference)
  motionQuery = null
})
</script>

<template>
  <canvas
    ref="canvasRef"
    data-camera-effect-overlay
    :data-camera-effect-id="normalizedEffectId"
    aria-hidden="true"
  ></canvas>
</template>
