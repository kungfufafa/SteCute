<script setup lang="ts">
import { useAppStore } from '@/app/store/useAppStore'

const appStore = useAppStore()
</script>

<template>
  <div
    v-if="appStore.offlineMode"
    class="border-stc-warning/30 bg-stc-warning-soft text-stc-text fixed inset-x-0 top-0 z-50 border-b px-4 py-3 text-center text-sm font-medium [contain:layout_style_paint]"
  >
    {{
      appStore.offlineReady
        ? 'Kamu sedang offline. Fitur inti tetap bisa dipakai.'
        : 'Kamu sedang offline. Kunjungan pertama perlu koneksi internet sampai cache selesai.'
    }}
  </div>
</template>
