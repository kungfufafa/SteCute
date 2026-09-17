<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { sizeCanvasToSource } from '@/services/camera/cover-crop'
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
  const proc = activeProcessor.value
  if (!canvas || !proc) return
  sizeCanvasToSource(canvas, proc.canvas)
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

  if (proc.isActive() && proc.canvas.width > 0 && proc.canvas.height > 0) {
    sizeCanvasToSource(canvas, proc.canvas)
    ctx.drawImage(proc.canvas, 0, 0)
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
  [
    normalizedId,
    () => props.customImage,
    () => props.mirrored,
    () => props.videoEl,
    () => props.processor,
  ],
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
      previewActive ? 'opacity-100' : 'pointer-events-none opacity-0',
    ]"
    aria-hidden="true"
  ></canvas>
</template>
