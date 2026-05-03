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
  <div v-if="error" :class="[ui.page, 'items-center justify-center p-4']">
    <div :class="[ui.panelSoft, 'w-full max-w-sm p-6 text-center']">
      <div :class="[ui.statusIcon, 'bg-stc-error-soft text-stc-error !mb-4 !size-14']">!</div>
      <h2 class="text-stc-error mb-2 text-lg font-bold">Ada yang bermasalah</h2>
      <p class="text-stc-text-soft mb-4 text-sm leading-relaxed">{{ error.message }}</p>
      <button :class="[ui.secondaryButton, 'w-full']" @click="dismiss">Tutup</button>
    </div>
  </div>
  <slot v-else />
</template>
