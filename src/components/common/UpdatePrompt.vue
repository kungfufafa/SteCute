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
      <div :class="[ui.panel, 'w-full max-w-sm p-5']">
        <h2 class="text-stc-text text-[15px] font-medium">Update Tersedia</h2>
        <p class="text-stc-text-soft mt-1 text-[13px] leading-normal">
          Versi baru Stecute tersedia. Muat ulang sekarang?
        </p>
        <p v-if="updateError" :class="[ui.alertError, 'mt-3']">
          {{ updateError }}
        </p>
        <div class="mt-4 flex items-center justify-end gap-2">
          <button :class="ui.ghostButton" :disabled="isUpdating" @click="dismiss">Nanti</button>
          <button :class="ui.primaryButton" :disabled="isUpdating" @click="acceptUpdate">
            {{ isUpdating ? 'Memuat Update...' : 'Muat Ulang' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
