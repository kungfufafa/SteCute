<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores'
import { resetSessionData } from '@/services/session'

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
  <div class="flex min-h-svh flex-col items-center justify-center bg-stc-bg p-4">
    <div class="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-sm">
      <h2 class="mb-2 text-lg font-semibold text-stc-text">Reset Session?</h2>
      <p class="mb-6 text-sm text-stc-text-soft">
        This will discard all photos in the current session. This action cannot be undone.
      </p>
      <div class="space-y-2">
        <button
          class="w-full rounded-xl bg-stc-error py-3 text-sm font-semibold text-white transition hover:opacity-90"
          @click="handleReset"
        >
          Reset Session
        </button>
        <button
          class="w-full rounded-xl border border-stc-border py-3 text-sm font-medium text-stc-text-soft transition hover:bg-stc-bg-2"
          @click="handleCancel"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>
