<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  seconds: number
  currentShot: number
  totalShots: number
}>()

const emit = defineEmits<{
  complete: []
}>()

const remaining = ref(props.seconds)
let interval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  interval = setInterval(() => {
    remaining.value--
    if (remaining.value <= 0) {
      clearInterval(interval!)
      interval = null
      emit('complete')
    }
  }, 1000)
})

onUnmounted(() => {
  if (interval) {
    clearInterval(interval)
    interval = null
  }
})
</script>

<template>
  <div class="flex min-h-svh flex-col items-center justify-center bg-black text-white">
    <p class="mb-4 text-sm tracking-wider text-white/60">
      FOTO {{ currentShot + 1 }} DARI {{ totalShots }}
    </p>
    <span class="text-9xl leading-none font-bold tabular-nums">{{ remaining }}</span>
  </div>
</template>
