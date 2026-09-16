<script setup lang="ts">
import { ui } from '@/ui/styles'

defineProps<{
  message?: string
}>()
</script>

<template>
  <div :class="[ui.page, 'items-center justify-center gap-3 px-4 text-center']">
    <div
      class="border-stc-border border-t-stc-pink size-6 animate-spin rounded-full border-2"
    ></div>
    <div class="space-y-1">
      <p class="text-stc-text text-[15px] font-medium">{{ message ?? 'Memuat...' }}</p>
      <p class="text-stc-text-faint text-[13px]">Menyiapkan pengalaman offline-first kamu.</p>
    </div>
  </div>
</template>
