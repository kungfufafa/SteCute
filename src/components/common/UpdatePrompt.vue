<script setup lang="ts">
import { ref } from 'vue'
import { ui } from '@/ui/styles'

const show = ref(false)
const isUpdating = ref(false)
const updateAction = ref<(() => Promise<void> | void) | null>(null)
const updateError = ref<string | null>(null)

function promptUpdate(action?: () => Promise<void> | void) {
  updateAction.value = action ?? null
  updateError.value = null
  isUpdating.value = false
  show.value = true
}

async function acceptUpdate() {
  isUpdating.value = true
  updateError.value = null

  if (!updateAction.value) {
    window.location.reload()
    return
  }

  try {
    await updateAction.value()
  } catch (error) {
    console.error('Failed to apply app update:', error)
    updateError.value = 'Gagal menerapkan update. Tutup tab ini lalu buka kembali Stecute.'
    isUpdating.value = false
  }
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
        <p
          v-if="updateError"
          class="border-stc-error/30 bg-stc-error-soft text-stc-error mb-4 rounded-xl border px-4 py-3 text-sm font-semibold"
        >
          {{ updateError }}
        </p>
        <div class="space-y-2">
          <button
            :class="[ui.primaryButton, 'w-full']"
            :disabled="isUpdating"
            @click="acceptUpdate"
          >
            {{ isUpdating ? 'Memuat Update...' : 'Muat Ulang' }}
          </button>
          <button :class="[ui.secondaryButton, 'w-full']" :disabled="isUpdating" @click="dismiss">
            Nanti
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
