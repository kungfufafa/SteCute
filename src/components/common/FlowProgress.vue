<script setup lang="ts">
import { computed } from 'vue'

type FlowStep = 'landing' | 'config' | 'capture' | 'review' | 'render' | 'output'
type CaptureSource = 'camera' | 'upload'

const props = withDefaults(
  defineProps<{
    current: FlowStep
    source?: CaptureSource | null
  }>(),
  {
    source: null,
  },
)

const steps = computed(() => [
  { id: 'landing' as const, label: 'Mulai' },
  { id: 'config' as const, label: 'Format' },
  { id: 'capture' as const, label: props.source === 'upload' ? 'Upload' : 'Foto' },
  { id: 'review' as const, label: 'Review' },
  { id: 'render' as const, label: 'Render' },
  { id: 'output' as const, label: 'Hasil' },
])

const currentIndex = computed(() =>
  Math.max(
    0,
    steps.value.findIndex((step) => step.id === props.current),
  ),
)
</script>

<template>
  <nav
    class="border-stc-border flex w-full items-center border-b px-4 py-2 sm:px-5"
    aria-label="Progress sesi Stecute"
  >
    <ol class="flex w-full flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px]">
      <li v-for="(step, index) in steps" :key="step.id" class="flex min-w-0 items-center gap-1.5">
        <span
          class="whitespace-nowrap"
          :class="
            index === currentIndex
              ? 'text-stc-text font-medium'
              : index < currentIndex
                ? 'text-stc-text-soft'
                : 'text-stc-text-faint'
          "
          :aria-current="index === currentIndex ? 'step' : undefined"
        >
          {{ step.label }}
        </span>
        <span v-if="index < steps.length - 1" class="text-stc-text-faint" aria-hidden="true">
          /
        </span>
      </li>
    </ol>
  </nav>
</template>
