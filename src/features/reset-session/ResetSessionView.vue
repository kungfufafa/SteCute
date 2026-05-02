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
  <div class="bg-stc-bg flex min-h-svh flex-col items-center justify-center p-4">
    <div
      class="border-stc-border shadow-stc-xs w-full max-w-sm rounded-2xl border bg-white p-6 text-center"
    >
      <h2 class="text-stc-text mb-2 text-lg font-semibold">Reset Sesi?</h2>
      <p class="text-stc-text-soft mb-6 text-sm">
        Semua foto di sesi ini akan dibuang. Tindakan ini tidak bisa dibatalkan.
      </p>
      <div class="space-y-2">
        <button
          :class="[ui.secondaryButton, 'bg-stc-error hover:bg-stc-error-strong w-full text-white']"
          @click="handleReset"
        >
          Reset Sesi
        </button>
        <button :class="[ui.secondaryButton, 'w-full']" @click="handleCancel">Batal</button>
      </div>
    </div>
  </div>
</template>
