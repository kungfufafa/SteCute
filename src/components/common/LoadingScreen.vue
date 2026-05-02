<script setup lang="ts">
defineProps<{
  message?: string
}>()
</script>

<template>
  <div class="bg-stc-bg flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
    <div class="relative flex size-16 items-center justify-center">
      <div
        class="border-stc-border border-t-stc-pink size-12 animate-spin rounded-full border-4"
      ></div>
    </div>
    <div class="space-y-1">
      <p class="text-stc-text text-base font-semibold">{{ message ?? 'Memuat...' }}</p>
      <p class="text-stc-text-faint text-sm">Menyiapkan pengalaman offline-first kamu.</p>
    </div>
  </div>
</template>
