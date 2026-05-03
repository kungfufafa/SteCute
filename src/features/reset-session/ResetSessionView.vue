<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores'
import { resetSessionData } from '@/services/session'
import { ui } from '@/ui/styles'

const router = useRouter()
const sessionStore = useSessionStore()

async function handleReset() {
  if (sessionStore.sessionId) {
    await resetSessionData(sessionStore.sessionId)
  }
  sessionStore.reset()
  router.push('/')
}

function handleCancel() {
  router.back()
}
</script>

<template>
  <div :class="[ui.page, 'items-center justify-center p-4']">
    <div :class="[ui.panelSoft, 'w-full max-w-sm p-6 text-center']">
      <h2 class="text-stc-text mb-2 text-lg font-bold">Reset Sesi?</h2>
      <p class="text-stc-text-soft mb-6 text-sm">
        Semua foto di sesi ini akan dibuang. Tindakan ini tidak bisa dibatalkan.
      </p>
      <div class="space-y-2">
        <button :class="[ui.dangerButton, 'w-full']" @click="handleReset">Reset Sesi</button>
        <button :class="[ui.secondaryButton, 'w-full']" @click="handleCancel">Batal</button>
      </div>
    </div>
  </div>
</template>
