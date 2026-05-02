<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'
import { ui } from '@/ui/styles'

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
  <div v-if="error" class="bg-stc-bg flex min-h-svh flex-col items-center justify-center p-4">
    <div
      class="border-stc-border shadow-stc-xs w-full max-w-sm rounded-2xl border bg-white p-6 text-center"
    >
      <div
        class="bg-stc-error-soft text-stc-error mx-auto mb-4 flex size-14 items-center justify-center rounded-full"
      >
        !
      </div>
      <h2 class="text-stc-error mb-2 text-lg font-semibold">Ada yang bermasalah</h2>
      <p class="text-stc-text-soft mb-4 text-sm leading-relaxed">{{ error.message }}</p>
      <button :class="[ui.secondaryButton, 'w-full']" @click="dismiss">Tutup</button>
    </div>
  </div>
  <slot v-else />
</template>
