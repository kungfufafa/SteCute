<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { layouts } from '@/layouts'
import type { LayoutConfig, TemplateConfig } from '@/db/schema'
import { getTemplatesForLayout } from '@/templates'
import { useCustomTemplateStore, useSessionStore } from '@/stores'
import { createTemplateFromStripFile, openStripTemplatePicker } from '@/services/template-upload'
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
const selectedOption = computed(
  () =>
    blankoOptions.value.find((option) => isBlankoSelected(option)) ??
    blankoOptions.value[0] ??
    null,
)
const selectedLayout = computed(() => selectedOption.value?.layout)
const selectedTemplate = computed(() => selectedOption.value?.template)
const selectedPhotoRatioLabel = computed(() =>
  selectedTemplate.value?.nativeLayout?.id === selectedLayoutId.value ||
  selectedTemplate.value?.layoutOverrides?.[selectedLayoutId.value]
    ? 'Sesuai blanko'
    : '4:3',
)
const sourceLabel = computed(() => (selectedSource.value === 'upload' ? 'Upload Lokal' : 'Kamera'))
const actionLabel = computed(() =>
  selectedSource.value === 'upload' ? 'Pilih Foto' : 'Buka Kamera',
)

const selectedTimer = ref(sessionStore.countdownSeconds)
const autoCapture = ref(sessionStore.autoCapture)
const customTemplateError = ref<string | null>(null)
const isUploadingTemplate = ref(false)

onMounted(() => {
  void customTemplateStore.loadPersistedTemplates()
})

watch(
  blankoOptions,
  () => {
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
  if (kind === 'public') return 'Public'
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
        ? (option.template.description ?? 'Blanko fleksibel untuk format standar.')
        : option.subtitle,
  }
}

function isPackageSelected(blankoPackage: BlankoPackage) {
  return (
    selectedTemplateId.value === blankoPackage.template.id &&
    blankoPackage.layouts.some((layout) => layout.id === selectedLayoutId.value)
  )
}

function isPackageLayoutSelected(blankoPackage: BlankoPackage, layout: LayoutConfig) {
  return isPackageSelected(blankoPackage) && selectedLayoutId.value === layout.id
}

function packagePreviewLayout(blankoPackage: BlankoPackage) {
  if (isPackageSelected(blankoPackage)) {
    return selectedLayout.value ?? blankoPackage.layouts[0]
  }

  return (
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
  const layout = packagePreviewLayout(blankoPackage)

  if (!layout) return

  selectedLayoutId.value = layout.id
  selectedTemplateId.value = blankoPackage.template.id
}

function selectBlankoPackageLayout(blankoPackage: BlankoPackage, layout: LayoutConfig) {
  selectedLayoutId.value = layout.id
  selectedTemplateId.value = blankoPackage.template.id
}

function proceed() {
  const option = selectedOption.value

  sessionStore.layoutId = option?.layout.id ?? selectedLayoutId.value
  sessionStore.templateId = option?.template.id ?? selectedTemplateId.value
  sessionStore.countdownSeconds = selectedTimer.value
  sessionStore.autoCapture = autoCapture.value
  sessionStore.slotCount = option?.layout.slotCount ?? 3
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
          <p :class="ui.subtitle">Pilih blanko strip dan pengaturan kamera.</p>
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
        <!-- Left: Blanko selection + Settings -->
        <section class="min-w-0 space-y-6 pb-28 lg:pb-0">
          <!-- Blanko selection -->
          <div>
            <div class="mb-3 max-w-2xl">
              <p :class="ui.sectionLabel">Blanko Strip</p>
              <h2 class="text-stc-text mt-1 text-lg font-bold sm:text-xl">Pilih paket strip.</h2>
            </div>

            <div
              class="border-stc-border bg-stc-bg-2 mb-3 flex flex-col gap-3 rounded-xl border px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div class="min-w-0">
                <p class="text-stc-text text-sm font-bold">Pakai blanko sendiri</p>
                <p class="text-stc-text-soft mt-0.5 text-[11px] leading-snug font-medium">
                  Upload PNG/WebP, jumlah area transparan akan dideteksi otomatis.
                </p>
              </div>
              <button
                class="border-stc-border text-stc-text hover:bg-stc-pink-soft hover:text-stc-pink focus-visible:ring-stc-pink shadow-stc-xs inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border bg-white px-3.5 py-2 text-xs font-bold transition-all duration-200 outline-none hover:-translate-y-[1px] focus-visible:ring-2 focus-visible:ring-offset-2 active:translate-y-0 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-60"
                :disabled="isUploadingTemplate"
                @click="handleUploadTemplate"
              >
                {{ isUploadingTemplate ? 'Membaca...' : 'Upload Blanko' }}
              </button>
            </div>

            <div
              v-if="customTemplateError"
              class="border-stc-error/30 bg-stc-error-soft text-stc-error mb-3 rounded-xl border px-4 py-3 text-sm font-semibold"
            >
              {{ customTemplateError }}
            </div>

            <div
              class="grid grid-cols-1 gap-3 min-[500px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
            >
              <div
                v-for="blankoPackage in blankoPackages"
                :key="blankoPackage.id"
                role="button"
                tabindex="0"
                :aria-label="`${blankoPackage.title}, ${packageSlotLabel(blankoPackage)}`"
                :class="[
                  'group focus-visible:ring-stc-pink flex min-h-[188px] cursor-pointer items-stretch gap-3 rounded-xl border p-3 text-left transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98]',
                  isPackageSelected(blankoPackage)
                    ? 'border-stc-pink bg-stc-pink-soft shadow-stc-sm -translate-y-0.5'
                    : 'border-stc-border hover:border-stc-border-strong hover:bg-stc-bg-2 shadow-stc-xs bg-white hover:-translate-y-0.5',
                ]"
                @click="selectBlankoPackage(blankoPackage)"
                @keydown.enter.prevent="selectBlankoPackage(blankoPackage)"
                @keydown.space.prevent="selectBlankoPackage(blankoPackage)"
              >
                <div class="flex w-16 shrink-0 items-center justify-center sm:w-20">
                  <StripCanvasPreview
                    :layout="packagePreviewLayout(blankoPackage)"
                    :template-config="blankoPackage.template"
                    class="pointer-events-none"
                  />
                </div>
                <div class="flex min-w-0 flex-1 flex-col justify-between gap-3">
                  <div>
                    <p
                      class="text-sm font-bold transition-colors duration-200"
                      :class="isPackageSelected(blankoPackage) ? 'text-stc-pink' : 'text-stc-text'"
                    >
                      {{ blankoPackage.title }}
                    </p>
                    <p class="text-stc-text-faint mt-1 text-[11px] leading-snug font-medium">
                      {{ blankoPackage.subtitle }}
                    </p>
                  </div>
                  <div class="flex flex-wrap items-center gap-1.5">
                    <template v-if="blankoPackage.layouts.length > 1">
                      <button
                        v-for="layout in blankoPackage.layouts"
                        :key="layout.id"
                        :aria-label="`${blankoPackage.title} ${layout.slotCount} foto`"
                        class="focus-visible:ring-stc-pink inline-flex min-h-7 min-w-9 items-center justify-center rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-95"
                        :class="
                          isPackageLayoutSelected(blankoPackage, layout)
                            ? 'bg-stc-pink shadow-stc-xs text-white'
                            : 'bg-stc-bg-2 text-stc-text-faint hover:text-stc-pink hover:bg-white'
                        "
                        @click.stop="selectBlankoPackageLayout(blankoPackage, layout)"
                      >
                        {{ layout.slotCount }}
                      </button>
                    </template>
                    <span
                      v-else
                      class="inline-flex w-fit rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase"
                      :class="
                        isPackageSelected(blankoPackage)
                          ? 'text-stc-pink shadow-stc-xs bg-white'
                          : 'bg-stc-bg-2 text-stc-text-faint'
                      "
                    >
                      {{ packageSlotLabel(blankoPackage) }}
                    </span>
                    <span
                      class="inline-flex w-fit rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase"
                      :class="
                        isPackageSelected(blankoPackage)
                          ? 'text-stc-pink shadow-stc-xs bg-white'
                          : 'bg-stc-bg-2 text-stc-text-faint'
                      "
                    >
                      {{ optionKindLabel(blankoPackage.kind) }}
                    </span>
                  </div>
                </div>
              </div>
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
                  {{ selectedTemplate?.name ?? 'Strip' }}
                </h3>
                <p class="text-stc-text-faint mt-0.5 text-[11px] font-semibold">
                  {{ selectedLayout?.printFormat.label ?? 'Format strip' }}
                </p>
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
