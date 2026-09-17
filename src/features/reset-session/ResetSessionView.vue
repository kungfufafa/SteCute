<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/app/store/useSessionStore'
import { resetSessionData } from '@/services/session'
import {
  clearPendingBoothSetup,
  clearPendingSessionConfig,
  readStoredSessionId,
} from '@/services/session/persist'
import { ui } from '@/ui/styles'

const router = useRouter()
const sessionStore = useSessionStore()

async function handleReset() {
  const sessionId = sessionStore.sessionId ?? readStoredSessionId()
  if (sessionId) {
    await resetSessionData(sessionId)
  }
  sessionStore.reset()
  clearPendingSessionConfig()
  clearPendingBoothSetup()
  router.push('/')
}

function handleCancel() {
  router.back()
}
</script>

<template>
  <div :class="[ui.page, 'items-center justify-center p-4']">
    <div :class="[ui.panel, 'w-full max-w-sm p-5']">
      <h2 class="text-stc-text text-[15px] font-medium">Reset Sesi?</h2>
      <p class="text-stc-text-soft mt-1 text-[13px] leading-normal">
        Semua foto di sesi ini akan dibuang. Tindakan ini tidak bisa dibatalkan.
      </p>
      <div class="mt-4 flex items-center justify-end gap-2">
        <button :class="ui.ghostButton" @click="handleCancel">Batal</button>
        <button :class="ui.dangerButton" @click="handleReset">Reset Sesi</button>
      </div>
    </div>
  </div>
</template>
