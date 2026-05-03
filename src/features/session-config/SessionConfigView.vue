<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { layouts } from '@/layouts'
import { useSessionStore } from '@/stores'
import { ui } from '@/ui/styles'
import StripPreview from '@/components/prototype/StripPreview.vue'
import FlowProgress from '@/components/common/FlowProgress.vue'

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

const selectedTimer = ref(sessionStore.countdownSeconds)
const autoCapture = ref(sessionStore.autoCapture)

function proceed() {
  sessionStore.layoutId = selectedLayoutId.value
  sessionStore.templateId = 'classic'
  sessionStore.countdownSeconds = selectedTimer.value
  sessionStore.autoCapture = autoCapture.value
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
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <div class="min-w-0">
          <h3 :class="ui.title">Pilih Jumlah Foto</h3>
          <p :class="ui.subtitle">Tentukan format strip sebelum sesi dimulai.</p>
        </div>
      </div>
      <span :class="ui.badge">{{ sourceLabel }}</span>
    </div>

    <FlowProgress current="config" :source="selectedSource" />

    <div :class="ui.content">
      <div
        :class="[
          ui.pageContentWide,
          'grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start',
        ]"
      >
        <section class="min-w-0 space-y-5">
          <div class="max-w-2xl space-y-2">
            <p :class="ui.sectionLabel">Strip</p>
            <h2 :class="ui.sectionTitle">Pilih komposisi foto.</h2>
            <p :class="ui.sectionCopy">
              Preview dan hasil akhir memakai layout yang sama. Semua format memakai template
              Classic dan tetap diproses lokal.
            </p>
          </div>

          <div class="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 sm:grid-cols-4 sm:gap-4">
            <button
              v-for="layout in layouts"
              :key="layout.id"
              :aria-label="`${layout.printFormat.label}, strip ${layout.printFormat.paperSize}, slot foto rasio 4:3`"
              :class="[
                'group focus-visible:ring-stc-pink relative flex flex-col rounded-xl border p-3.5 text-left transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98]',
                selectedLayoutId === layout.id
                  ? 'border-stc-pink bg-stc-pink-soft shadow-stc-sm -translate-y-0.5'
                  : 'border-stc-border hover:border-stc-border-strong hover:bg-stc-bg-2 shadow-stc-xs bg-white hover:-translate-y-0.5',
              ]"
              @click="selectedLayoutId = layout.id"
            >
              <div
                class="mb-4 flex aspect-[9/14] flex-col gap-1.5 rounded-xl border p-2 transition-colors duration-200"
                :class="
                  selectedLayoutId === layout.id
                    ? 'border-stc-pink/30 bg-white/60'
                    : 'border-stc-border bg-white'
                "
              >
                <div
                  v-for="index in layout.slotCount"
                  :key="index"
                  class="min-h-0 flex-1 rounded-[2px] transition-colors duration-200"
                  :class="
                    selectedLayoutId === layout.id
                      ? 'bg-stc-pink/40'
                      : 'bg-stc-bg-3 group-hover:bg-stc-border'
                  "
                ></div>
                <div class="flex h-4 items-center justify-center">
                  <img
                    src="/icons.svg"
                    alt="Stecute"
                    class="block w-auto transition-opacity duration-200"
                    style="height: 7px"
                    :class="selectedLayoutId === layout.id ? 'opacity-60' : 'opacity-30'"
                  />
                </div>
              </div>

              <div class="flex items-center justify-between gap-3">
                <div>
                  <p
                    class="text-sm font-bold transition-colors duration-200"
                    :class="selectedLayoutId === layout.id ? 'text-stc-pink' : 'text-stc-text'"
                  >
                    {{ layout.printFormat.label }}
                  </p>
                  <p class="text-stc-text-faint text-xs leading-snug font-medium">
                    {{ layout.printFormat.description }}
                  </p>
                </div>
                <span
                  class="inline-flex min-w-[32px] items-center justify-center rounded-lg border px-1.5 py-1 text-xs font-bold transition-colors duration-200"
                  :class="
                    selectedLayoutId === layout.id
                      ? 'border-stc-pink text-stc-pink shadow-stc-xs bg-white'
                      : 'border-stc-border text-stc-text-faint group-hover:border-stc-border-strong bg-white'
                  "
                >
                  {{ layout.slotCount }}
                </span>
              </div>
            </button>
          </div>

          <div v-if="selectedSource === 'camera'" class="mt-8 space-y-5">
            <div class="max-w-2xl space-y-2">
              <p :class="ui.sectionLabel">Kamera</p>
              <h2 :class="ui.sectionTitle">Pengaturan Sesi</h2>
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div :class="ui.panelSoft" class="p-4 sm:p-5">
                <p :class="ui.sectionLabel" class="mb-3">Waktu Timer</p>
                <div class="grid grid-cols-3 gap-2">
                  <button
                    v-for="time in [3, 5, 10]"
                    :key="time"
                    :class="[
                      'rounded-lg border px-3 py-2 text-sm font-bold transition-all',
                      selectedTimer === time
                        ? 'border-stc-pink bg-stc-pink-soft text-stc-pink'
                        : 'border-stc-border text-stc-text hover:bg-stc-bg-2'
                    ]"
                    @click="selectedTimer = time"
                  >
                    {{ time }}s
                  </button>
                </div>
              </div>

              <div :class="ui.panelSoft" class="p-4 sm:p-5">
                <p :class="ui.sectionLabel" class="mb-3">Mode Pengambilan</p>
                <button
                  :class="[
                    'flex w-full items-center justify-between rounded-lg border px-4 py-2.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stc-pink',
                    autoCapture
                      ? 'border-stc-pink bg-stc-pink-soft text-stc-pink'
                      : 'border-stc-border text-stc-text hover:bg-stc-bg-2'
                  ]"
                  @click="autoCapture = !autoCapture"
                >
                  <span class="text-sm font-bold">Otomatis Berlanjut</span>
                  <div
                    :class="[
                      'relative h-5 w-9 rounded-full transition-colors',
                      autoCapture ? 'bg-stc-pink' : 'bg-stc-border-strong'
                    ]"
                  >
                    <div
                      :class="[
                        'absolute top-1 left-1 size-3 rounded-full bg-white transition-transform',
                        autoCapture ? 'translate-x-4' : ''
                      ]"
                    ></div>
                  </div>
                </button>
                <p class="mt-2 text-xs font-medium text-stc-text-soft">
                  Ambil semua foto otomatis tanpa klik ulang.
                </p>
              </div>
            </div>
          </div>
        </section>

        <aside class="lg:sticky lg:top-8" aria-label="Preview layout terpilih">
          <div :class="[ui.panel, 'p-5 sm:p-6']">
            <div class="mb-5 flex items-start justify-between gap-4">
              <div>
                <p :class="ui.sectionLabel">Preview</p>
                <h3 class="text-stc-text mt-1 text-lg font-bold">
                  {{ selectedLayout?.printFormat.label ?? 'Strip' }}
                </h3>
              </div>
              <span :class="ui.pinkBadge">
                {{ selectedLayout?.slotCount ?? sessionStore.slotCount }} Foto
              </span>
            </div>

            <div class="mx-auto max-w-[210px]">
              <StripPreview
                :slot-count="selectedLayout?.slotCount ?? sessionStore.slotCount"
                title="Classic"
                :badge="selectedLayout?.printFormat.paperSize"
                footer="Stecute"
                variant="mini"
              />
            </div>

            <div class="mt-6 grid grid-cols-2 gap-3 text-sm">
              <div :class="ui.softTile">
                <p :class="ui.sectionLabel">Rasio</p>
                <p class="text-stc-text mt-1 font-bold">4:3</p>
              </div>
              <div :class="ui.softTile">
                <p :class="ui.sectionLabel">Output</p>
                <p class="text-stc-text mt-1 font-bold">PNG</p>
              </div>
            </div>

            <button :class="[ui.primaryButton, 'mt-6 w-full']" @click="proceed">
              {{ actionLabel }}
            </button>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>
