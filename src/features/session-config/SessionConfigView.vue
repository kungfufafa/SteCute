<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { layouts } from '@/layouts'
import { useSessionStore } from '@/stores'
import { ui } from '@/ui/styles'

const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()

type CaptureSource = 'camera' | 'upload'

const selectedSource = computed<CaptureSource>(() =>
  route.query.source === 'upload' ? 'upload' : 'camera',
)
const selectedLayoutId = ref(sessionStore.layoutId)
const selectedLayout = computed(() =>
  layouts.find((layout) => layout.id === selectedLayoutId.value),
)
const sourceLabel = computed(() => (selectedSource.value === 'upload' ? 'Upload Lokal' : 'Kamera'))
const actionLabel = computed(() =>
  selectedSource.value === 'upload' ? 'Pilih Foto' : 'Buka Kamera',
)

function proceed() {
  sessionStore.layoutId = selectedLayoutId.value
  sessionStore.templateId = 'classic'
  sessionStore.countdownSeconds = 3
  sessionStore.slotCount = selectedLayout.value?.slotCount ?? 3
  router.push(selectedSource.value === 'upload' ? '/upload' : '/camera')
}

function goBack() {
  router.push('/')
}
</script>

<template>
  <div :class="ui.page">
    <div :class="ui.header">
      <div :class="ui.headerGroup">
        <button :class="ui.iconButton" aria-label="Kembali ke beranda" @click="goBack">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <div class="min-w-0">
          <h3 :class="ui.title">Pilih Jumlah Foto</h3>
          <p :class="ui.subtitle">Preview dan hasil akhir memakai layout yang sama.</p>
        </div>
      </div>
      <span :class="ui.badge">{{ sourceLabel }}</span>
    </div>

    <div :class="ui.content">
      <div :class="[ui.contentWrap, 'gap-6']">
        <section class="space-y-4">
          <div class="space-y-1">
            <p :class="ui.sectionLabel">Strip</p>
            <h4 class="text-stc-text text-base font-semibold">Mau berapa foto?</h4>
          </div>

          <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <button
              v-for="layout in layouts"
              :key="layout.id"
              :aria-label="`${layout.printFormat.label}, strip ${layout.printFormat.paperSize}, slot foto rasio 4:3`"
              :class="[
                'group shadow-stc-xs rounded-xl border p-3 text-left transition-colors duration-150',
                selectedLayoutId === layout.id
                  ? 'border-stc-pink bg-stc-pink-soft'
                  : 'border-stc-border hover:border-stc-border-strong hover:bg-stc-bg-2 bg-white',
              ]"
              @click="selectedLayoutId = layout.id"
            >
              <div
                class="border-stc-border mb-3 flex aspect-[9/14] flex-col gap-1.5 rounded-lg border bg-white p-2"
              >
                <div
                  v-for="index in layout.slotCount"
                  :key="index"
                  class="bg-stc-bg-3 min-h-0 flex-1 transition-colors"
                  :class="selectedLayoutId === layout.id ? 'bg-stc-pink/35' : 'bg-stc-border'"
                ></div>
                <div class="text-stc-text h-4 text-center text-[8px] font-bold">photobooth</div>
              </div>

              <div class="flex items-center justify-between gap-3">
                <div>
                  <p
                    class="text-sm font-semibold transition-colors"
                    :class="selectedLayoutId === layout.id ? 'text-stc-pink' : 'text-stc-text'"
                  >
                    {{ layout.printFormat.label }}
                  </p>
                  <p class="text-stc-text-faint text-xs">{{ layout.printFormat.description }}</p>
                </div>
                <span
                  class="inline-flex min-w-8 items-center justify-center rounded-lg border px-1.5 py-1 text-xs font-bold transition-colors"
                  :class="
                    selectedLayoutId === layout.id
                      ? 'border-stc-pink text-stc-pink bg-white'
                      : 'border-stc-border text-stc-text-faint bg-white'
                  "
                >
                  {{ layout.slotCount }}
                </span>
              </div>
            </button>
          </div>
        </section>

        <div class="mt-auto pb-2">
          <button :class="[ui.primaryButton, 'w-full sm:w-auto sm:min-w-56']" @click="proceed">
            {{ actionLabel }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
