<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  initFaceDetector,
  detectFaces,
  destroyFaceDetector,
  isFaceDetectorReady,
} from '@/services/face-tracking'
import type { FaceBounds } from '@/services/face-tracking'
import {
  drawFaceTrackingEffect,
  normalizeCameraEffectFrameMs,
  preloadCameraEffectAssets,
  resolveFaceTrackingEffectFaces,
} from '@/services/camera-effects'

const props = defineProps<{
  /** The video element to detect faces from */
  videoEl: HTMLVideoElement | null
  /** The face-tracking effect ID (e.g. 'hearts' or 'bluebirds') */
  effectId: string
  /** Whether the visible preview is mirrored horizontally */
  mirrored?: boolean
}>()

const emit = defineEmits<{
  'update:faces': [faces: FaceBounds[]]
  'update:frame-ms': [frameMs: number]
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const detectedFaceCount = ref(0)
const prefersReducedMotion = ref(false)
const currentFrameMs = ref(0)

let animFrameId: number | null = null
let resizeObserver: InstanceType<typeof window.ResizeObserver> | null = null
let motionQuery: ReturnType<typeof window.matchMedia> | null = null
let lastDetectionRun = 0

// Smoothed face positions for less jittery rendering
let smoothedFaces: FaceBounds[] = []
const SMOOTHING = 0.35 // Lower = smoother but more laggy
const DETECTION_INTERVAL_MS = 120

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function smoothFaces(newFaces: FaceBounds[]): FaceBounds[] {
  // Match faces to existing tracked faces by proximity
  const result: FaceBounds[] = []

  for (let i = 0; i < newFaces.length; i++) {
    const target = newFaces[i]

    if (i < smoothedFaces.length) {
      // Smooth towards detected position
      result.push({
        x: lerp(smoothedFaces[i].x, target.x, SMOOTHING),
        y: lerp(smoothedFaces[i].y, target.y, SMOOTHING),
        width: lerp(smoothedFaces[i].width, target.width, SMOOTHING),
        height: lerp(smoothedFaces[i].height, target.height, SMOOTHING),
      })
    } else {
      // New face, start at detected position
      result.push({ ...target })
    }
  }

  smoothedFaces = result
  return result
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function mapVideoFaceToCanvas(
  face: FaceBounds,
  video: HTMLVideoElement,
  rect: { width: number; height: number },
  mirrored: boolean,
): FaceBounds {
  const scale = Math.max(rect.width / video.videoWidth, rect.height / video.videoHeight)
  const drawnWidth = video.videoWidth * scale
  const drawnHeight = video.videoHeight * scale
  const offsetX = (rect.width - drawnWidth) / 2
  const offsetY = (rect.height - drawnHeight) / 2

  const mappedWidth = (face.width * video.videoWidth * scale) / rect.width
  const mappedHeight = (face.height * video.videoHeight * scale) / rect.height
  const mappedX = (face.x * video.videoWidth * scale + offsetX) / rect.width
  const mappedY = (face.y * video.videoHeight * scale + offsetY) / rect.height
  const x = mirrored ? 1 - mappedX - mappedWidth : mappedX

  return {
    x: clamp01(x),
    y: clamp01(mappedY),
    width: clamp01(mappedWidth),
    height: clamp01(mappedHeight),
  }
}

async function initDetector() {
  try {
    await initFaceDetector()
  } catch (error) {
    console.warn('Face tracking not available:', error)
  }
}

function startLoop() {
  if (animFrameId !== null) return
  loop()
}

function stopLoop() {
  if (animFrameId !== null) {
    window.cancelAnimationFrame(animFrameId)
    animFrameId = null
  }
}

function loop() {
  animFrameId = window.requestAnimationFrame(() => {
    renderFrame()
    loop()
  })
}

function renderFrame() {
  const canvas = canvasRef.value
  const video = props.videoEl
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return

  const now = window.performance.now()
  const frameMs = prefersReducedMotion.value ? 0 : normalizeCameraEffectFrameMs(now, props.effectId)
  currentFrameMs.value = Math.round(frameMs)
  emit('update:frame-ms', frameMs)

  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
  const nextWidth = Math.max(1, Math.round(rect.width * pixelRatio))
  const nextHeight = Math.max(1, Math.round(rect.height * pixelRatio))

  if (canvas.width !== nextWidth) canvas.width = nextWidth
  if (canvas.height !== nextHeight) canvas.height = nextHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  ctx.clearRect(0, 0, rect.width, rect.height)

  let faces = smoothedFaces
  const canDetect = Boolean(video && isFaceDetectorReady() && video.videoWidth > 0)
  const shouldDetect = canDetect && now - lastDetectionRun >= DETECTION_INTERVAL_MS

  if (!canDetect) {
    faces = []
    smoothedFaces = []
  } else if (shouldDetect && video) {
    lastDetectionRun = now
    const result = detectFaces(video)

    if (result.faces.length > 0) {
      faces = smoothFaces(
        result.faces.map((face) => mapVideoFaceToCanvas(face, video, rect, props.mirrored ?? true)),
      )
    } else {
      faces = []
      smoothedFaces = []
    }
  }

  faces = resolveFaceTrackingEffectFaces(faces)

  detectedFaceCount.value = faces.length
  emit('update:faces', faces)

  drawFaceTrackingEffect(ctx, rect.width, rect.height, props.effectId, faces, { timeMs: frameMs })
}

function syncMotionPreference() {
  prefersReducedMotion.value = motionQuery?.matches ?? false
}

async function preloadAndRenderEffect() {
  await preloadCameraEffectAssets(props.effectId)
  await nextTick()
  renderFrame()
}

watch(
  () => props.effectId,
  () => {
    smoothedFaces = []
    void preloadAndRenderEffect()
    void nextTick(renderFrame)
  },
)

onMounted(() => {
  if (typeof window.matchMedia === 'function') {
    motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    syncMotionPreference()
    motionQuery.addEventListener?.('change', syncMotionPreference)
  }

  startLoop()
  void preloadAndRenderEffect()
  void initDetector()

  if (typeof window.ResizeObserver !== 'undefined' && canvasRef.value) {
    resizeObserver = new window.ResizeObserver(() => renderFrame())
    resizeObserver.observe(canvasRef.value)
  }
})

onBeforeUnmount(() => {
  stopLoop()
  resizeObserver?.disconnect()
  resizeObserver = null
  motionQuery?.removeEventListener?.('change', syncMotionPreference)
  motionQuery = null
  destroyFaceDetector()
})
</script>

<template>
  <canvas
    ref="canvasRef"
    data-face-tracking-overlay
    :data-camera-effect-id="effectId"
    :data-overlay-frame-ms="currentFrameMs"
    :data-face-count="detectedFaceCount"
    aria-hidden="true"
  ></canvas>
</template>
