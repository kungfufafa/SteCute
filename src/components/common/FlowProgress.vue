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
    class="mx-auto w-full max-w-6xl px-4 pb-4 sm:px-6 md:px-8"
    aria-label="Progress sesi Stecute"
  >
    <ol class="border-stc-border/70 shadow-stc-xs flex w-full gap-1 rounded-xl border bg-white/85 p-1 sm:grid sm:grid-cols-6 sm:p-1.5">
      <li 
        v-for="(step, index) in steps" 
        :key="step.id" 
        :class="[
          'min-w-0 transition-all duration-300 ease-out',
          index === currentIndex ? 'flex-[2.5] sm:flex-none' : 'flex-1 sm:flex-none'
        ]"
      >
        <div
          class="flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-[0.5rem] px-1 text-[0.6875rem] font-bold transition-colors duration-200 sm:min-h-11 sm:flex-col sm:gap-1 sm:rounded-lg sm:px-2 sm:text-[0.625rem] md:flex-row md:gap-2 md:px-3 lg:text-xs"
          :class="
            index === currentIndex
              ? 'bg-stc-pink text-white shadow-stc-xs'
              : index < currentIndex
                ? 'bg-stc-pink-soft text-stc-pink hover:bg-stc-pink/20'
                : 'text-stc-text-faint hover:bg-stc-bg-2'
          "
          :aria-current="index === currentIndex ? 'step' : undefined"
        >
          <span
            class="flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] transition-colors"
            :class="
              index === currentIndex
                ? 'bg-white/20 text-white'
                : index < currentIndex
                  ? 'bg-white text-stc-pink'
                  : 'bg-stc-bg-2 text-stc-text-faint group-hover:bg-stc-border'
            "
          >
            {{ index + 1 }}
          </span>
          <span 
            class="overflow-hidden whitespace-nowrap transition-all duration-300"
            :class="[
              index === currentIndex 
                ? 'max-w-[80px] opacity-100 sm:max-w-full' 
                : 'max-w-0 opacity-0 sm:max-w-full sm:opacity-100'
            ]"
          >
            {{ step.label }}
          </span>
        </div>
      </li>
    </ol>
  </nav>
</template>
