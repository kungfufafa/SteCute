<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { layouts, standardLayouts } from '@/layouts'
import type { LayoutConfig, TemplateConfig } from '@/db/schema'
import { getTemplatesForLayout } from '@/templates'
import { useCustomTemplateStore } from '@/app/store/useCustomTemplateStore'
import { useSessionStore } from '@/app/store/useSessionStore'
import { createTemplateFromStripFile, openStripTemplatePicker } from '@/services/template-upload'
import { writePendingSessionConfig } from '@/services/session/persist'
import { ui } from '@/ui/styles'
import StripCanvasPreview from '@/components/common/StripCanvasPreview.vue'
import FlowProgress from '@/components/common/FlowProgress.vue'

const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()
const customTemplateStore = useCustomTemplateStore()

type CaptureSource = 'camera' | 'upload'
type BlankoOptionKind = 'standard' | 'public' | 'custom'

interface BlankoOption {
  id: string
  layout: LayoutConfig
  template: TemplateConfig
  kind: BlankoOptionKind
  title: string
  subtitle: string
}

interface BlankoPackage {
  id: string
  template: TemplateConfig
  kind: BlankoOptionKind
  layouts: LayoutConfig[]
  title: string
  subtitle: string
}

const selectedSource = computed<CaptureSource>(() =>
  route.query.source === 'upload' ? 'upload' : 'camera',
)
const selectedLayoutId = ref(sessionStore.layoutId)
const selectedTemplateId = ref(sessionStore.templateId)
const customTemplates = computed(() => customTemplateStore.templates)

const bundledBlankoOptions = computed(() =>
  layouts.flatMap((layout) =>
    getTemplatesForLayout(layout.id).map((template) =>
      createBlankoOption(
        layout,
        template,
        template.nativeLayout?.id === layout.id ? 'public' : 'standard',
      ),
    ),
  ),
)
const customBlankoOptions = computed(() =>
  customTemplates.value.flatMap((template) =>
    template.nativeLayout ? [createBlankoOption(template.nativeLayout, template, 'custom')] : [],
  ),
)
const blankoOptions = computed(() => {
  return [...bundledBlankoOptions.value, ...customBlankoOptions.value]
})
const blankoPackages = computed(() => {
  const packages: BlankoPackage[] = []
  const standardPackagesByTemplate = new Map<string, BlankoPackage>()

  for (const option of bundledBlankoOptions.value) {
    if (option.kind !== 'standard') {
      packages.push(createBlankoPackage(option))
      continue
    }

    const existing = standardPackagesByTemplate.get(option.template.id)

    if (existing) {
      existing.layouts.push(option.layout)
      continue
    }

    const blankoPackage = createBlankoPackage(option)
    standardPackagesByTemplate.set(option.template.id, blankoPackage)
    packages.push(blankoPackage)
  }

  for (const custom of customBlankoOptions.value) {
    packages.push(createBlankoPackage(custom))
  }

  return packages
})
const selectedOption = computed(() => {
  const matched = blankoOptions.value.find((option) => isBlankoSelected(option))
  if (matched) return matched
  if (!templatesReady.value) return null
  return blankoOptions.value[0] ?? null
})
const selectedLayout = computed(() => selectedOption.value?.layout)
const selectedTemplate = computed(() => selectedOption.value?.template)
const sourceLabel = computed(() => (selectedSource.value === 'upload' ? 'Upload Lokal' : 'Kamera'))
const actionLabel = computed(() =>
  selectedSource.value === 'upload' ? 'Pilih Foto' : 'Buka Kamera',
)

const selectedTimer = ref(sessionStore.countdownSeconds)
const autoCapture = ref(sessionStore.autoCapture)
const customTemplateError = ref<string | null>(null)
const isUploadingTemplate = ref(false)
const templatesReady = ref(false)

onMounted(async () => {
  await customTemplateStore.loadPersistedTemplates()
  templatesReady.value = true
})

watch(
  [blankoOptions, templatesReady],
  () => {
    if (!templatesReady.value) return
    if (blankoOptions.value.some((option) => isBlankoSelected(option))) return

    const fallback =
      blankoOptions.value.find(
        (option) => option.layout.id === 'strip-3-vertical' && option.template.id === 'classic',
      ) ??
      blankoOptions.value.find((option) => option.template.id === 'classic') ??
      blankoOptions.value[0]

    if (fallback) selectBlankoOption(fallback)
  },
  { immediate: true },
)

function createBlankoOption(
  layout: LayoutConfig,
  template: TemplateConfig,
  kind: BlankoOptionKind,
): BlankoOption {
  const usesNativeLayout = template.nativeLayout?.id === layout.id

  return {
    id: `${layout.id}:${template.id}`,
    layout,
    template,
    kind,
    title: template.name,
    subtitle: usesNativeLayout
      ? (template.description ?? layout.printFormat.description)
      : `${layout.printFormat.label} · ${layout.printFormat.description}`,
  }
}

function optionKindLabel(kind: BlankoOptionKind) {
  if (kind === 'custom') return 'Upload'
  if (kind === 'public') return 'Publik'
  return 'Standar'
}

function createBlankoPackage(option: BlankoOption): BlankoPackage {
  return {
    id: option.kind === 'standard' ? option.template.id : option.id,
    template: option.template,
    kind: option.kind,
    layouts: [option.layout],
    title: option.title,
    subtitle:
      option.kind === 'standard'
        ? (option.template.description ?? 'Frame fleksibel untuk format standar.')
        : option.subtitle,
  }
}

function isPackageSelected(blankoPackage: BlankoPackage) {
  return selectedTemplateId.value === blankoPackage.template.id
}

function packagePreviewLayout(blankoPackage: BlankoPackage) {
  if (blankoPackage.template.nativeLayout) {
    return blankoPackage.template.nativeLayout
  }

  return (
    selectedLayout.value ??
    blankoPackage.layouts.find((layout) => layout.id === selectedLayoutId.value) ??
    blankoPackage.layouts.find((layout) => layout.id === 'strip-3-vertical') ??
    blankoPackage.layouts[0]
  )
}

function packageSlotLabel(blankoPackage: BlankoPackage) {
  if (blankoPackage.layouts.length === 1) return `${blankoPackage.layouts[0].slotCount} Foto`
  return `${blankoPackage.layouts.map((layout) => layout.slotCount).join('/')} Foto`
}

function isBlankoSelected(option: BlankoOption) {
  return (
    option.layout.id === selectedLayoutId.value && option.template.id === selectedTemplateId.value
  )
}

function selectBlankoOption(option: BlankoOption) {
  selectedLayoutId.value = option.layout.id
  selectedTemplateId.value = option.template.id
}

function selectBlankoPackage(blankoPackage: BlankoPackage) {
  selectedTemplateId.value = blankoPackage.template.id
  if (blankoPackage.template.nativeLayout) {
    selectedLayoutId.value = blankoPackage.template.nativeLayout.id
  } else if (!standardLayouts.some((layout) => layout.id === selectedLayoutId.value)) {
    selectedLayoutId.value = 'strip-3-vertical'
  }
}

function selectLayout(layout: LayoutConfig) {
  const previousTemplate = selectedTemplate.value
  selectedLayoutId.value = layout.id
  if (previousTemplate?.nativeLayout && previousTemplate.nativeLayout.id !== layout.id) {
    selectedTemplateId.value = 'classic'
  }
}

function proceed() {
  const option = selectedOption.value

  sessionStore.layoutId = option?.layout.id ?? selectedLayoutId.value
  sessionStore.templateId = option?.template.id ?? selectedTemplateId.value
  sessionStore.countdownSeconds = selectedTimer.value
  sessionStore.autoCapture = autoCapture.value
  sessionStore.slotCount = option?.layout.slotCount ?? 3

  writePendingSessionConfig({
    layoutId: sessionStore.layoutId,
    templateId: sessionStore.templateId,
    slotCount: sessionStore.slotCount,
    countdownSeconds: sessionStore.countdownSeconds,
    autoCapture: sessionStore.autoCapture,
    source: selectedSource.value,
  })

  router.push(selectedSource.value === 'upload' ? '/upload' : '/camera')
}

function goBack() {
  router.push('/')
}

async function handleUploadTemplate() {
  if (isUploadingTemplate.value) return

  customTemplateError.value = null
  const file = await openStripTemplatePicker()
  if (!file) return

  isUploadingTemplate.value = true

  try {
    const uploaded = await createTemplateFromStripFile({
      file,
    })
    const layout = uploaded.template.nativeLayout

    if (!layout) {
      throw new Error('Blanko custom tidak punya layout valid.')
    }

    await customTemplateStore.saveTemplate(uploaded)
    selectBlankoOption(createBlankoOption(layout, uploaded.template, 'custom'))
  } catch (error) {
    customTemplateError.value =
      error instanceof Error ? error.message : 'Gagal membaca blanko custom.'
  } finally {
    isUploadingTemplate.value = false
  }
}
</script>

<template>
  <div :class="ui.page">
    <div :class="ui.header">
      <div :class="ui.headerGroup">
        <button :class="ui.iconButton" aria-label="Kembali ke beranda" @click="goBack">
          <svg
            width="16"
            height="16"
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
        <h1 :class="ui.title">Atur Sesi</h1>
      </div>
      <span :class="ui.badge">{{ sourceLabel }}</span>
    </div>

    <FlowProgress current="config" :source="selectedSource" />

    <div :class="ui.content">
      <div
        :class="[
          ui.pageContentWide,
          'grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start',
        ]"
      >
        <section class="min-w-0 space-y-8 pb-28 lg:pb-8">
          <div>
            <p :class="ui.sectionLabel">Jumlah Foto</p>
            <div class="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <button
                v-for="layout in standardLayouts"
                :key="layout.id"
                type="button"
                :aria-label="`${selectedTemplate?.name ?? 'Classic'} ${layout.slotCount} foto`"
                :class="[
                  'focus-visible:ring-stc-pink/40 flex items-center justify-center rounded-lg border p-3.5 text-center transition-all outline-none focus-visible:ring-2',
                  selectedLayoutId === layout.id && !selectedTemplate?.nativeLayout
                    ? ui.selectedCard
                    : ui.card,
                ]"
                @click="selectLayout(layout)"
              >
                <span class="text-stc-text text-base font-semibold"
                  >{{ layout.slotCount }} Foto</span
                >
              </button>
            </div>
          </div>

          <div>
            <p :class="ui.sectionLabel">Frame</p>
            <div class="mt-3 grid grid-cols-1 gap-2.5 min-[500px]:grid-cols-2 xl:grid-cols-3">
              <button
                v-for="blankoPackage in blankoPackages"
                :key="blankoPackage.id"
                type="button"
                :aria-label="`${blankoPackage.title}, ${packageSlotLabel(blankoPackage)}`"
                :class="[
                  'focus-visible:ring-stc-pink/40 flex min-h-24 cursor-pointer items-center gap-3.5 rounded-lg border p-3 text-left transition-all outline-none focus-visible:ring-2',
                  isPackageSelected(blankoPackage) ? ui.selectedCard : ui.card,
                ]"
                @click="selectBlankoPackage(blankoPackage)"
              >
                <div class="flex w-12 shrink-0 items-center justify-center sm:w-14">
                  <StripCanvasPreview
                    :layout="packagePreviewLayout(blankoPackage)"
                    :template-config="blankoPackage.template"
                    class="pointer-events-none"
                  />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5">
                    <p class="text-stc-text text-[13px] font-medium">
                      {{ blankoPackage.title }}
                    </p>
                    <span :class="ui.badge">
                      {{ optionKindLabel(blankoPackage.kind) }}
                    </span>
                  </div>
                </div>
              </button>
            </div>

            <div v-if="customTemplateError" :class="[ui.alertError, 'mt-3']">
              {{ customTemplateError }}
            </div>

            <div class="mt-3">
              <button
                :class="ui.secondaryButton"
                :disabled="isUploadingTemplate"
                @click="handleUploadTemplate"
              >
                {{ isUploadingTemplate ? 'Membaca...' : 'Upload Frame' }}
              </button>
            </div>
          </div>

          <div v-if="selectedSource === 'camera'">
            <div class="border-stc-border divide-stc-border divide-y border-y">
              <div class="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p class="text-stc-text text-[13px] font-medium">Timer</p>
                <div :class="[ui.segmented, 'w-full sm:w-fit']">
                  <button
                    v-for="time in [3, 5, 10]"
                    :key="time"
                    :class="[
                      ui.segmentedItem,
                      'flex-1 sm:min-w-12 sm:flex-none',
                      selectedTimer === time ? ui.segmentedItemActive : '',
                    ]"
                    @click="selectedTimer = time"
                  >
                    {{ time }}s
                  </button>
                </div>
              </div>

              <div class="flex items-center justify-between gap-4 py-3">
                <p class="text-stc-text text-[13px] font-medium">Otomatis</p>
                <button
                  type="button"
                  class="focus-visible:ring-stc-pink/40 relative h-5 w-9 shrink-0 rounded-full transition-colors outline-none focus-visible:ring-2"
                  :class="autoCapture ? 'bg-stc-pink' : 'bg-stc-bg-3'"
                  aria-label="Otomatis"
                  :aria-pressed="autoCapture"
                  @click="autoCapture = !autoCapture"
                >
                  <span
                    class="absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition-transform"
                    :class="autoCapture ? 'translate-x-4' : ''"
                    aria-hidden="true"
                  ></span>
                </button>
              </div>
            </div>
          </div>
        </section>

        <aside class="hidden lg:sticky lg:top-6 lg:block" aria-label="Preview layout terpilih">
          <div :class="[ui.panel, 'p-4']">
            <div class="mb-3 flex items-start justify-between gap-3">
              <div>
                <p :class="ui.sectionLabel">Preview</p>
                <h3 class="text-stc-text mt-0.5 text-[13px] font-medium">
                  {{ selectedTemplate?.name ?? 'Strip' }}
                </h3>
                <p class="text-stc-text-faint mt-0.5 text-[13px]">
                  {{ selectedLayout?.printFormat.label ?? 'Format strip' }}
                </p>
              </div>
              <span :class="ui.badge">
                {{ selectedLayout?.slotCount ?? sessionStore.slotCount }} Foto
              </span>
            </div>

            <div class="mx-auto max-w-[160px]">
              <StripCanvasPreview :layout="selectedLayout" :template-config="selectedTemplate" />
            </div>

            <button :class="[ui.primaryButton, 'mt-4 w-full']" @click="proceed">
              {{ actionLabel }}
            </button>
          </div>
        </aside>
      </div>
    </div>

    <div
      class="border-stc-border stc-safe-bottom fixed right-0 bottom-0 left-0 z-30 border-t bg-white px-4 py-3 lg:hidden"
    >
      <div class="mx-auto flex max-w-lg items-center gap-3">
        <div class="min-w-0 flex-1">
          <p class="text-stc-text truncate text-[13px] font-medium">
            {{ selectedTemplate?.name ?? 'Classic' }} ·
            {{ selectedLayout?.slotCount ?? sessionStore.slotCount }} foto
          </p>
        </div>
        <button :class="ui.primaryButton" @click="proceed">
          {{ actionLabel }}
        </button>
      </div>
    </div>
  </div>
</template>
