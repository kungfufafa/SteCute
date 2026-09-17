<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  CameraBackgroundProcessor,
  isVirtualBackgroundActive,
  normalizeVirtualBackgroundId,
  type BackgroundProcessorStatus,
  type CameraBackgroundProcessorLike,
  type RgbaFrame,
} from '@/services/virtual-background'

const props = withDefaults(
  defineProps<{
    videoEl?: HTMLVideoElement | null
    backgroundId: string
    customImage?: RgbaFrame | null
    mirrored?: boolean
    processor?: CameraBackgroundProcessorLike | null
  }>(),
  {
    videoEl: null,
    customImage: null,
    mirrored: false,
    processor: null,
  },
)

const emit = defineEmits<{
  active: [active: boolean]
  status: [status: BackgroundProcessorStatus]
  error: [error: string | null]
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const previewActive = ref(false)

let internalProcessor: CameraBackgroundProcessor | null = null
let animFrameId: number | null = null
let resizeObserver: InstanceType<typeof window.ResizeObserver> | null = null

const normalizedId = computed(() => normalizeVirtualBackgroundId(props.backgroundId))
const backgroundEnabled = computed(() => isVirtualBackgroundActive(normalizedId.value))
const activeProcessor = computed(() => props.processor ?? internalProcessor)

function setActive(active: boolean) {
  if (previewActive.value === active) return
  previewActive.value = active
  emit('active', active)
}

function updateCanvasSize() {
  const canvas = canvasRef.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const width = rect.width > 0 ? rect.width : (canvas.parentElement?.clientWidth ?? 0)
  const height = rect.height > 0 ? rect.height : (canvas.parentElement?.clientHeight ?? 0)
  if (width <= 0 || height <= 0) return

  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
  const nextWidth = Math.max(1, Math.round(width * pixelRatio))
  const nextHeight = Math.max(1, Math.round(height * pixelRatio))

  if (canvas.width !== nextWidth) canvas.width = nextWidth
  if (canvas.height !== nextHeight) canvas.height = nextHeight
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
  const proc = activeProcessor.value

  if (!canvas || !backgroundEnabled.value || !proc) {
    setActive(false)
    return
  }

  updateCanvasSize()

  if (canvas.width <= 0 || canvas.height <= 0) {
    setActive(false)
    return
  }

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    setActive(false)
    return
  }

  // If processor is active and has rendered content
  if (proc.isActive() && proc.canvas.width > 0 && proc.canvas.height > 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(proc.canvas, 0, 0, canvas.width, canvas.height)
    setActive(true)
    emit('status', proc.currentStatus)
    emit('error', proc.error)
    return
  }

  setActive(false)
}

async function syncProcessor() {
  if (!props.processor && props.videoEl && !internalProcessor) {
    internalProcessor = new CameraBackgroundProcessor({
      video: props.videoEl,
      mirrored: props.mirrored,
      onStatusChange: (status, error) => {
        emit('status', status)
        emit('error', error ?? null)
      },
    })
  }

  const proc = activeProcessor.value
  if (!proc) return

  if (backgroundEnabled.value) {
    await proc.configure(
      { id: normalizedId.value, customImage: props.customImage },
      { mirrored: props.mirrored },
    )
    startLoop()
    void nextTick(renderFrame)
  } else {
    await proc.configure({ id: 'off' }, { mirrored: props.mirrored })
    stopLoop()
    setActive(false)
  }
}

watch(
  [normalizedId, () => props.customImage, () => props.mirrored, () => props.videoEl, () => props.processor],
  () => {
    void syncProcessor()
  },
)

onMounted(() => {
  void syncProcessor()

  if (typeof window.ResizeObserver !== 'undefined' && canvasRef.value) {
    resizeObserver = new window.ResizeObserver(() => {
      updateCanvasSize()
      renderFrame()
    })
    resizeObserver.observe(canvasRef.value)
  }
})

onBeforeUnmount(() => {
  stopLoop()
  resizeObserver?.disconnect()
  resizeObserver = null
  if (internalProcessor) {
    internalProcessor.dispose()
    internalProcessor = null
  }
})

defineExpose({
  canvas: canvasRef,
  getProcessor: () => activeProcessor.value,
})
</script>

<template>
  <canvas
    ref="canvasRef"
    data-virtual-background-preview
    :data-virtual-background-id="normalizedId"
    :class="[
      'h-full w-full object-cover transition-opacity duration-150',
      previewActive ? 'opacity-100' : 'opacity-0 pointer-events-none',
    ]"
    aria-hidden="true"
  ></canvas>
</template>
