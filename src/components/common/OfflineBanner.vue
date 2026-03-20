<script setup lang="ts">
import { useAppStore } from '@/stores'

const appStore = useAppStore()
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="-translate-y-full opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="-translate-y-full opacity-0"
  >
    <div
      v-if="appStore.offlineMode"
      class="fixed inset-x-0 top-0 z-50 border-b border-stc-warning/30 bg-stc-warning-soft/95 px-4 py-3 text-center text-sm font-medium text-stc-text shadow-[0_10px_28px_rgba(245,158,11,0.18)] backdrop-blur [contain:layout_style_paint]"
    >
      Kamu sedang offline. Fitur inti tetap bisa dipakai.
    </div>
  </Transition>
</template>
