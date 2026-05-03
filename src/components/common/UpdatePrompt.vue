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
      <div :class="[ui.panel, 'w-full max-w-sm p-6 text-center']">
        <div :class="[ui.surfaceIcon, '!mb-4 !size-14 text-xl']">↑</div>
        <h2 class="text-stc-text mb-2 text-lg font-bold">Update Tersedia</h2>
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
