<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { layouts } from '@/layouts'
import { templates } from '@/templates'
import { useSessionStore } from '@/stores'
import { ui } from '@/ui/styles'

const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()

const selectedLayoutId = ref(sessionStore.layoutId)
const selectedTemplateId = ref(sessionStore.templateId)
const selectedCountdown = ref(sessionStore.countdownSeconds)
const countdownOptions = [3, 5, 10] as const

const selectedLayout = computed(() =>
  layouts.find((layout) => layout.id === selectedLayoutId.value),
)
const selectedSource = computed<'camera' | 'upload'>(() =>
  route.query.source === 'upload' ? 'upload' : 'camera',
)

function templatePreview(templateId: string) {
  if (templateId === 'classic') return 'linear-gradient(180deg,#fffdf8,#f5f0e8)'
  if (templateId === 'youth') return 'linear-gradient(180deg,#3b82f6,#1d4ed8)'

  return 'linear-gradient(180deg,#2d2d2d,#111)'
}

function proceed() {
  sessionStore.layoutId = selectedLayoutId.value
  sessionStore.templateId = selectedTemplateId.value
  sessionStore.countdownSeconds = selectedCountdown.value
  sessionStore.slotCount = selectedLayout.value?.slotCount ?? 4
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
        <button :class="ui.iconButton" @click="goBack">
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
          <h3 :class="ui.title">Setup Sesi</h3>
          <p :class="ui.subtitle">
            Pilih hasil cetak, template, dan countdown untuk alur
            {{ selectedSource === 'upload' ? 'upload lokal' : 'kamera' }}.
          </p>
        </div>
      </div>
      <span :class="ui.badge">{{ selectedSource === 'upload' ? 'Upload' : 'Camera' }}</span>
    </div>

    <div :class="ui.content">
      <div :class="[ui.contentWrap, 'gap-8']">
        <section class="space-y-4">
          <div class="space-y-1">
            <p :class="ui.sectionLabel">Hasil Cetak</p>
            <h4 class="text-base font-semibold text-stc-text">Pilih hasil cetak</h4>
          </div>

          <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <button
              v-for="layout in layouts"
              :key="layout.id"
              :class="[
                'group rounded-[24px] border p-3 text-left shadow-stc-sm transition-all duration-200 hover:-translate-y-0.5',
                selectedLayoutId === layout.id
                  ? 'border-stc-pink bg-stc-pink-soft shadow-[0_14px_32px_rgba(244,91,141,0.16)]'
                  : 'border-stc-border bg-white hover:border-stc-border-strong hover:bg-stc-bg-2',
              ]"
              @click="selectedLayoutId = layout.id"
            >
              <div
                :class="[
                  'mb-3 flex h-24 flex-col gap-2 rounded-2xl border border-stc-border/80 bg-stc-bg-2 p-3',
                ]"
              >
                <div
                  v-for="index in layout.slotCount"
                  :key="index"
                  :class="[
                    'flex-1 rounded-xl transition-colors',
                    selectedLayoutId === layout.id ? 'bg-stc-pink/70' : 'bg-stc-border',
                  ]"
                ></div>
              </div>

              <div class="flex items-center justify-between gap-3">
                <div>
                  <p
                    class="text-sm font-semibold transition-colors"
                    :class="selectedLayoutId === layout.id ? 'text-stc-pink' : 'text-stc-text'"
                  >
                    {{ layout.printFormat.label }}
                  </p>
                  <p class="text-xs text-stc-text-faint">{{ layout.printFormat.description }}</p>
                </div>
                <span
                  class="inline-flex size-7 items-center justify-center rounded-full border text-xs font-bold transition-colors"
                  :class="
                    selectedLayoutId === layout.id
                      ? 'border-stc-pink bg-white text-stc-pink'
                      : 'border-stc-border bg-white text-stc-text-faint'
                  "
                >
                  {{ layout.printFormat.paperSize.replace(' in', '') }}
                </span>
              </div>
            </button>
          </div>
        </section>

        <section class="space-y-4">
          <div class="space-y-1">
            <p :class="ui.sectionLabel">Template</p>
            <h4 class="text-base font-semibold text-stc-text">Pilih template</h4>
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              v-for="template in templates"
              :key="template.id"
              :class="[
                'rounded-[24px] border p-4 text-left shadow-stc-sm transition-all duration-200 hover:-translate-y-0.5',
                selectedTemplateId === template.id
                  ? 'border-stc-pink bg-stc-pink-soft shadow-[0_14px_32px_rgba(244,91,141,0.16)]'
                  : 'border-stc-border bg-white hover:border-stc-border-strong hover:bg-stc-bg-2',
              ]"
              @click="selectedTemplateId = template.id"
            >
              <div
                class="mb-4 h-32 rounded-[20px] border border-white/50 shadow-inner"
                :style="{ background: templatePreview(template.id) }"
              ></div>
              <div class="flex items-center justify-between gap-3">
                <div>
                  <p
                    class="text-base font-semibold transition-colors"
                    :class="selectedTemplateId === template.id ? 'text-stc-pink' : 'text-stc-text'"
                  >
                    {{ template.name }}
                  </p>
                  <p class="text-xs text-stc-text-faint">Bundled offline</p>
                </div>
                <span
                  class="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]"
                  :class="
                    selectedTemplateId === template.id
                      ? 'bg-white text-stc-pink'
                      : 'bg-stc-bg-2 text-stc-text-faint'
                  "
                >
                  Ready
                </span>
              </div>
            </button>
          </div>
        </section>

        <section class="space-y-4">
          <div class="space-y-1">
            <p :class="ui.sectionLabel">Countdown</p>
            <h4 class="text-base font-semibold text-stc-text">Atur tempo pengambilan</h4>
          </div>

          <div class="grid grid-cols-3 gap-3">
            <button
              v-for="seconds in countdownOptions"
              :key="seconds"
              :class="[
                'rounded-[24px] border p-4 text-center shadow-stc-sm transition-all duration-200 hover:-translate-y-0.5',
                selectedCountdown === seconds
                  ? 'border-stc-pink bg-stc-pink-soft shadow-[0_14px_32px_rgba(244,91,141,0.16)]'
                  : 'border-stc-border bg-white hover:border-stc-border-strong hover:bg-stc-bg-2',
              ]"
              @click="selectedCountdown = seconds"
            >
              <div
                class="text-3xl font-black tracking-tight"
                :class="selectedCountdown === seconds ? 'text-stc-pink' : 'text-stc-text'"
              >
                {{ seconds }}
              </div>
              <div class="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-stc-text-faint">
                Detik
              </div>
            </button>
          </div>
        </section>

        <div class="mt-auto pb-2">
          <button :class="[ui.primaryButton, 'w-full sm:w-auto sm:min-w-56']" @click="proceed">
            Mulai Sesi
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
