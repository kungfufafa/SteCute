<script setup lang="ts">
import { ref } from 'vue'

const show = ref(false)

function promptUpdate() {
  show.value = true
}

function acceptUpdate() {
  window.location.reload()
}

function dismiss() {
  show.value = false
}

defineExpose({ promptUpdate })
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(26,26,46,0.5)] p-4 backdrop-blur-sm [contain:layout_style_paint]"
    >
      <div
        class="w-full max-w-sm rounded-[28px] border border-stc-border bg-white/95 p-6 text-center shadow-[0_28px_80px_rgba(26,26,46,0.18)]"
      >
        <div
          class="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-stc-pink-soft text-xl text-stc-pink"
        >
          ↑
        </div>
        <h2 class="mb-2 text-lg font-semibold text-stc-text">Update Available</h2>
        <p class="mb-6 text-sm leading-relaxed text-stc-text-soft">
          A new version of Stecute is available. Update now?
        </p>
        <div class="space-y-2">
          <button
            class="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-stc-pink px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(244,91,141,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(244,91,141,0.32)] active:scale-[0.98]"
            @click="acceptUpdate"
          >
            Update Now
          </button>
          <button
            class="inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-stc-border bg-white px-5 py-3 text-sm font-medium text-stc-text-soft shadow-stc-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-stc-bg-2 active:scale-[0.98]"
            @click="dismiss"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
