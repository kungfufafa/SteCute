<script setup lang="ts">
defineProps<{
  message?: string
}>()
</script>

<template>
  <div
    class="flex min-h-svh flex-col items-center justify-center gap-4 bg-stc-bg px-4 text-center"
  >
    <div class="relative flex size-16 items-center justify-center">
      <div class="absolute inset-0 rounded-full border-4 border-stc-border/70"></div>
      <div
        class="size-16 animate-spin rounded-full border-4 border-transparent border-r-stc-pink/60 border-t-stc-pink"
      ></div>
      <div class="absolute size-5 rounded-full bg-stc-pink/15"></div>
    </div>
    <div class="space-y-1">
      <p class="text-base font-semibold text-stc-text">{{ message ?? 'Loading...' }}</p>
      <p class="text-sm text-stc-text-faint">Menyiapkan pengalaman offline-first kamu.</p>
    </div>
  </div>
</template>
