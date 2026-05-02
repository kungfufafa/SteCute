<script setup lang="ts">
import { ref } from 'vue'
import { ui } from '@/ui/styles'

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
      class="bg-stc-text/45 fixed inset-0 z-50 flex items-center justify-center p-4 [contain:layout_style_paint]"
    >
      <div
        class="border-stc-border shadow-stc-sm w-full max-w-sm rounded-2xl border bg-white p-6 text-center"
      >
        <div
          class="bg-stc-pink-soft text-stc-pink mx-auto mb-4 flex size-14 items-center justify-center rounded-full text-xl"
        >
          ↑
        </div>
        <h2 class="text-stc-text mb-2 text-lg font-semibold">Update Tersedia</h2>
        <p class="text-stc-text-soft mb-6 text-sm leading-relaxed">
          Versi baru Stecute tersedia. Muat ulang sekarang?
        </p>
        <div class="space-y-2">
          <button :class="[ui.primaryButton, 'w-full']" @click="acceptUpdate">Muat Ulang</button>
          <button :class="[ui.secondaryButton, 'w-full']" @click="dismiss">Nanti</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
