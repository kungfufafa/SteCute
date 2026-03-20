<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'

const error = ref<Error | null>(null)

onErrorCaptured((err) => {
  error.value = err
  return false
})

function dismiss() {
  error.value = null
}
</script>

<template>
  <div
    v-if="error"
    class="flex min-h-svh flex-col items-center justify-center bg-stc-bg p-4"
  >
    <div
      class="w-full max-w-sm rounded-[28px] border border-stc-border bg-white/95 p-6 text-center shadow-[0_24px_60px_rgba(26,26,46,0.12)] backdrop-blur"
    >
      <div
        class="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-stc-error-soft text-stc-error"
      >
        !
      </div>
      <h2 class="mb-2 text-lg font-semibold text-stc-error">Something went wrong</h2>
      <p class="mb-4 text-sm leading-relaxed text-stc-text-soft">{{ error.message }}</p>
      <button
        class="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-stc-text px-5 py-3 text-sm font-semibold text-white shadow-stc-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-stc-text-soft active:scale-[0.98]"
        @click="dismiss"
      >
        Dismiss
      </button>
    </div>
  </div>
  <slot v-else />
</template>
