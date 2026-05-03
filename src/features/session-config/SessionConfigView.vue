<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { layouts } from '@/layouts'
import { getTemplateById, getTemplatesForLayout, isTemplateSupportedForLayout } from '@/templates'
import { useSessionStore } from '@/stores'
import { ui } from '@/ui/styles'
import StripCanvasPreview from '@/components/common/StripCanvasPreview.vue'
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
const selectedTemplateId = ref(sessionStore.templateId)
const availableTemplates = computed(() => getTemplatesForLayout(selectedLayoutId.value))
const selectedTemplate = computed(
  () => getTemplateById(selectedTemplateId.value) ?? availableTemplates.value[0],
)
const selectedPhotoRatioLabel = computed(() =>
  selectedTemplate.value?.layoutOverrides?.[selectedLayoutId.value] ? 'Sesuai blanko' : '4:3',
)
const sourceLabel = computed(() => (selectedSource.value === 'upload' ? 'Upload Lokal' : 'Kamera'))
const actionLabel = computed(() =>
  selectedSource.value === 'upload' ? 'Pilih Foto' : 'Buka Kamera',
)

const selectedTimer = ref(sessionStore.countdownSeconds)
const autoCapture = ref(sessionStore.autoCapture)

watch(
  selectedLayoutId,
  (layoutId) => {
    const template = getTemplateById(selectedTemplateId.value)

    if (!template || !isTemplateSupportedForLayout(template, layoutId)) {
      selectedTemplateId.value =
        availableTemplates.value.find((item) => item.id === 'classic')?.id ??
        availableTemplates.value[0]?.id ??
        'classic'
    }
  },
  { immediate: true },
)

function proceed() {
  sessionStore.layoutId = selectedLayoutId.value
  sessionStore.templateId = selectedTemplate.value?.id ?? 'classic'
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
          <h3 :class="ui.title">Atur Sesi</h3>
          <p :class="ui.subtitle">Pilih format strip dan pengaturan kamera.</p>
        </div>
      </div>
      <span :class="ui.badge">{{ sourceLabel }}</span>
    </div>

    <FlowProgress current="config" :source="selectedSource" />

    <div :class="ui.content">
      <div
        :class="[
          ui.pageContentWide,
          'grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start',
        ]"
      >
        <!-- Left: Layout selection + Settings -->
        <section class="min-w-0 space-y-6 pb-28 lg:pb-0">
          <!-- Layout selection -->
          <div>
            <div class="mb-3">
              <p :class="ui.sectionLabel">Format Strip</p>
              <h2 class="text-stc-text mt-1 text-lg font-bold sm:text-xl">Pilih jumlah foto.</h2>
            </div>

            <!-- Compact layout grid -->
            <div class="grid grid-cols-4 gap-2 sm:gap-3">
              <button
                v-for="layout in layouts"
                :key="layout.id"
                :aria-label="`${layout.printFormat.label}, ${layout.printFormat.paperSize}`"
                :class="[
                  'group focus-visible:ring-stc-pink relative flex flex-col items-center rounded-xl border p-2.5 text-center transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.97] sm:p-3.5',
                  selectedLayoutId === layout.id
                    ? 'border-stc-pink bg-stc-pink-soft shadow-stc-sm -translate-y-0.5'
                    : 'border-stc-border hover:border-stc-border-strong hover:bg-stc-bg-2 shadow-stc-xs bg-white hover:-translate-y-0.5',
                ]"
                @click="selectedLayoutId = layout.id"
              >
                <!-- Compact strip icon -->
                <div
                  class="mb-2 flex w-full flex-col gap-[3px] rounded-lg border p-1.5 transition-colors duration-200 sm:gap-1 sm:p-2"
                  :class="
                    selectedLayoutId === layout.id
                      ? 'border-stc-pink/30 bg-white/60'
                      : 'border-stc-border bg-white'
                  "
                  style="aspect-ratio: 3 / 4"
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
                </div>

                <!-- Label -->
                <p
                  class="text-xs font-bold transition-colors duration-200 sm:text-sm"
                  :class="selectedLayoutId === layout.id ? 'text-stc-pink' : 'text-stc-text'"
                >
                  {{ layout.slotCount }} Foto
                </p>
                <p
                  class="text-stc-text-faint mt-0.5 hidden text-[10px] leading-snug font-medium sm:block"
                >
                  {{ layout.printFormat.description }}
                </p>
              </button>
            </div>
          </div>

          <!-- Template selection -->
          <div>
            <div class="mb-3">
              <p :class="ui.sectionLabel">Blanko</p>
              <h2 class="text-stc-text mt-1 text-lg font-bold sm:text-xl">Pilih template strip.</h2>
            </div>

            <div class="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
              <button
                v-for="template in availableTemplates"
                :key="template.id"
                :aria-label="`Template ${template.name}`"
                :class="[
                  'group focus-visible:ring-stc-pink flex min-h-[178px] items-stretch gap-3 rounded-xl border p-3 text-left transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98]',
                  selectedTemplateId === template.id
                    ? 'border-stc-pink bg-stc-pink-soft shadow-stc-sm -translate-y-0.5'
                    : 'border-stc-border hover:border-stc-border-strong hover:bg-stc-bg-2 shadow-stc-xs bg-white hover:-translate-y-0.5',
                ]"
                @click="selectedTemplateId = template.id"
              >
                <div class="flex w-16 shrink-0 items-center justify-center sm:w-20">
                  <StripCanvasPreview
                    :layout="selectedLayout"
                    :template-config="template"
                    class="pointer-events-none"
                  />
                </div>
                <div class="flex min-w-0 flex-1 flex-col justify-between gap-3">
                  <div>
                    <p
                      class="text-sm font-bold transition-colors duration-200"
                      :class="
                        selectedTemplateId === template.id ? 'text-stc-pink' : 'text-stc-text'
                      "
                    >
                      {{ template.name }}
                    </p>
                    <p class="text-stc-text-faint mt-1 text-[11px] leading-snug font-medium">
                      {{ template.description }}
                    </p>
                  </div>
                  <span
                    class="inline-flex w-fit rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase"
                    :class="
                      selectedTemplateId === template.id
                        ? 'text-stc-pink shadow-stc-xs bg-white'
                        : 'bg-stc-bg-2 text-stc-text-faint'
                    "
                  >
                    {{ template.blanko.mode === 'image' ? 'PNG Blanko' : 'Generated' }}
                  </span>
                </div>
              </button>
            </div>
          </div>

          <!-- Camera settings (inline, compact) -->
          <div v-if="selectedSource === 'camera'" class="space-y-4">
            <div>
              <p :class="ui.sectionLabel">Pengaturan</p>
              <h2 class="text-stc-text mt-1 text-lg font-bold sm:text-xl">Timer & Mode</h2>
            </div>

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <!-- Timer -->
              <div :class="ui.panelSoft" class="p-3.5 sm:p-4">
                <p :class="ui.sectionLabel" class="mb-2.5">Waktu Timer</p>
                <div class="grid grid-cols-3 gap-2">
                  <button
                    v-for="time in [3, 5, 10]"
                    :key="time"
                    :class="[
                      'rounded-lg border px-3 py-2 text-sm font-bold transition-all',
                      selectedTimer === time
                        ? 'border-stc-pink bg-stc-pink-soft text-stc-pink'
                        : 'border-stc-border text-stc-text hover:bg-stc-bg-2',
                    ]"
                    @click="selectedTimer = time"
                  >
                    {{ time }}s
                  </button>
                </div>
              </div>

              <!-- Auto capture toggle -->
              <div :class="ui.panelSoft" class="p-3.5 sm:p-4">
                <p :class="ui.sectionLabel" class="mb-2.5">Mode Pengambilan</p>
                <button
                  :class="[
                    'focus-visible:ring-stc-pink flex w-full items-center justify-between rounded-lg border px-3.5 py-2 transition-all focus-visible:ring-2 focus-visible:outline-none',
                    autoCapture
                      ? 'border-stc-pink bg-stc-pink-soft text-stc-pink'
                      : 'border-stc-border text-stc-text hover:bg-stc-bg-2',
                  ]"
                  @click="autoCapture = !autoCapture"
                >
                  <span class="text-sm font-bold">Otomatis</span>
                  <div
                    :class="[
                      'relative h-5 w-9 rounded-full transition-colors',
                      autoCapture ? 'bg-stc-pink' : 'bg-stc-border-strong',
                    ]"
                  >
                    <div
                      :class="[
                        'absolute top-1 left-1 size-3 rounded-full bg-white transition-transform',
                        autoCapture ? 'translate-x-4' : '',
                      ]"
                    ></div>
                  </div>
                </button>
                <p class="text-stc-text-soft mt-1.5 text-[11px] font-medium">
                  Ambil semua foto otomatis tanpa klik ulang.
                </p>
              </div>
            </div>
          </div>

          <!-- Desktop CTA (hidden on mobile, shown on desktop inline) -->
          <div class="hidden lg:block">
            <button
              :class="[ui.primaryButton, 'w-full sm:w-auto sm:min-w-[200px]']"
              @click="proceed"
            >
              {{ actionLabel }}
            </button>
          </div>
        </section>

        <!-- Right: Preview sidebar (desktop only) -->
        <aside class="hidden lg:sticky lg:top-8 lg:block" aria-label="Preview layout terpilih">
          <div :class="[ui.panel, 'p-5']">
            <div class="mb-4 flex items-start justify-between gap-3">
              <div>
                <p :class="ui.sectionLabel">Preview</p>
                <h3 class="text-stc-text mt-1 text-base font-bold">
                  {{ selectedLayout?.printFormat.label ?? 'Strip' }}
                </h3>
              </div>
              <span :class="ui.pinkBadge">
                {{ selectedLayout?.slotCount ?? sessionStore.slotCount }} Foto
              </span>
            </div>

            <div class="mx-auto max-w-[180px]">
              <StripCanvasPreview :layout="selectedLayout" :template-config="selectedTemplate" />
            </div>

            <div class="mt-4 grid grid-cols-2 gap-2.5 text-sm">
              <div :class="ui.softTile">
                <p :class="ui.sectionLabel">Rasio</p>
                <p class="text-stc-text mt-0.5 text-sm font-bold">{{ selectedPhotoRatioLabel }}</p>
              </div>
              <div :class="ui.softTile">
                <p :class="ui.sectionLabel">Output</p>
                <p class="text-stc-text mt-0.5 text-sm font-bold">PNG</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>

    <!-- Mobile fixed bottom CTA bar -->
    <div
      class="border-stc-border stc-safe-bottom fixed right-0 bottom-0 left-0 z-30 border-t bg-white/95 px-4 py-3 backdrop-blur-md lg:hidden"
    >
      <div class="mx-auto flex max-w-lg items-center gap-3">
        <!-- Mini preview info -->
        <div class="flex min-w-0 flex-1 items-center gap-3">
          <div
            class="border-stc-pink/30 bg-stc-pink-soft flex size-11 flex-shrink-0 flex-col items-center justify-center gap-[2px] rounded-lg border p-1"
          >
            <div
              v-for="index in selectedLayout?.slotCount ?? 3"
              :key="index"
              class="bg-stc-pink/50 h-[3px] w-full rounded-sm"
            ></div>
          </div>
          <div class="min-w-0">
            <p class="text-stc-text truncate text-sm font-bold">
              {{ selectedLayout?.printFormat.label ?? 'Strip' }}
            </p>
            <p class="text-stc-text-faint text-[11px] font-medium">
              {{ selectedLayout?.printFormat.paperSize }} ·
              {{ selectedTemplate?.name ?? 'Classic' }} · PNG
            </p>
          </div>
        </div>
        <button
          class="bg-stc-pink shadow-stc-sm hover:bg-stc-pink-strong inline-flex min-h-[46px] shrink-0 items-center justify-center rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-all duration-200 active:scale-[0.97]"
          @click="proceed"
        >
          {{ actionLabel }}
        </button>
      </div>
    </div>
  </div>
</template>
