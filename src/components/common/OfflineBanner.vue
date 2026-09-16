<script setup lang="ts">
import { useAppStore } from '@/app/store/useAppStore'

const appStore = useAppStore()
</script>

<template>
  <div
    v-if="appStore.offlineMode"
    class="bg-stc-warning-soft text-stc-text border-stc-warning/20 fixed inset-x-0 top-0 z-50 border-b px-4 py-2 text-center text-[13px] [contain:layout_style_paint]"
  >
    {{
      appStore.offlineReady
        ? 'Kamu sedang offline. Fitur inti tetap bisa dipakai.'
        : 'Kamu sedang offline. Kunjungan pertama perlu koneksi internet sampai cache selesai.'
    }}
  </div>
</template>
