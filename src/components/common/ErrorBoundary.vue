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
    <div :class="[ui.panel, 'w-full max-w-sm p-5']">
      <h2 class="text-stc-text text-[15px] font-medium">Ada yang bermasalah</h2>
      <p class="text-stc-text-soft mt-1 text-[13px] leading-normal">{{ error.message }}</p>
      <div class="mt-4 flex justify-end">
        <button :class="ui.secondaryButton" @click="dismiss">Tutup</button>
      </div>
    </div>
  </div>
  <slot v-else />
</template>
