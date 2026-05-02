<script setup lang="ts">
import { ref } from 'vue'
import { RouterView } from 'vue-router'
import OfflineBanner from '@/components/common/OfflineBanner.vue'
import ErrorBoundary from '@/components/common/ErrorBoundary.vue'
import UpdatePrompt from '@/components/common/UpdatePrompt.vue'
import { useRegisterSW } from 'virtual:pwa-register/vue'

const updatePromptRef = ref<InstanceType<typeof UpdatePrompt> | null>(null)

useRegisterSW({
  onNeedRefresh() {
    updatePromptRef.value?.promptUpdate()
  },
})
</script>

<template>
  <ErrorBoundary>
    <OfflineBanner />
    <UpdatePrompt ref="updatePromptRef" />
    <div class="bg-stc-bg text-stc-text min-h-dvh">
      <RouterView />
    </div>
  </ErrorBoundary>
</template>
