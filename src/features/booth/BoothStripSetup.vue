<script setup lang="ts">
import { computed } from 'vue'
import type { LayoutConfig, TemplateConfig } from '@/db/schema'
import { getLayoutById } from '@/layouts'
import { getTemplateById } from '@/templates'
import {
  BOOTH_COUNTDOWN_SECONDS,
  bundledBoothLayouts,
  bundledBoothTemplates,
  normalizeBoothSetup,
  type BoothSessionSetup,
} from '@/services/booth'
import { ui } from '@/ui/styles'
import StripCanvasPreview from '@/components/common/StripCanvasPreview.vue'

const props = defineProps<{
  setup: BoothSessionSetup
  disabled?: boolean
}>()

const emit = defineEmits<{
  change: [setup: BoothSessionSetup]
}>()

interface BlankoPackage {
  id: string
  template: TemplateConfig
  layouts: LayoutConfig[]
}

const packages = computed<BlankoPackage[]>(() =>
  bundledBoothTemplates().map((template) => ({
    id: template.id,
    template,
    layouts: bundledBoothLayouts(),
  })),
)

const selectedLayout = computed(
  () => getLayoutById(props.setup.layoutId) ?? bundledBoothLayouts()[0],
)
const countdownSeconds = computed(() => Math.round(props.setup.countdownMs / 1000))
const selectedTemplateName = computed(
  () => getTemplateById(props.setup.templateId)?.name ?? 'Classic',
)
const layoutOptions = bundledBoothLayouts()

function isPackageSelected(blankoPackage: BlankoPackage) {
  return props.setup.templateId === blankoPackage.template.id
}

function isLayoutSelected(layout: LayoutConfig) {
  return props.setup.layoutId === layout.id
}

function packagePreviewLayout(blankoPackage: BlankoPackage) {
  if (isPackageSelected(blankoPackage)) return selectedLayout.value
  return (
    blankoPackage.layouts.find((layout) => layout.id === 'strip-3-vertical') ??
    blankoPackage.layouts[0]
  )
}

function packageSlotLabel(blankoPackage: BlankoPackage) {
  return `${blankoPackage.layouts.map((layout) => layout.slotCount).join('/')} Foto`
}

function update(partial: Partial<BoothSessionSetup>) {
  if (props.disabled) return
  emit('change', normalizeBoothSetup({ ...props.setup, ...partial }))
}

function selectPackage(blankoPackage: BlankoPackage) {
  const layout = packagePreviewLayout(blankoPackage)
  if (!layout) return
  update({
    layoutId: layout.id,
    templateId: blankoPackage.template.id,
    slotCount: layout.slotCount,
  })
}

function selectLayoutCount(layout: LayoutConfig) {
  update({ layoutId: layout.id, slotCount: layout.slotCount })
}

function selectCountdown(seconds: number) {
  update({ countdownMs: seconds * 1000 })
}
</script>

<template>
  <div class="space-y-3">
    <p :class="ui.sectionLabel">Blanko</p>

    <div class="grid grid-cols-3 gap-2">
      <button
        v-for="blankoPackage in packages"
        :key="blankoPackage.id"
        type="button"
        :disabled="disabled"
        :aria-label="`${blankoPackage.template.name}, ${packageSlotLabel(blankoPackage)}`"
        :class="[
          'focus-visible:ring-stc-pink/40 flex flex-col items-center gap-2 rounded-lg border p-2 text-center outline-none focus-visible:ring-2 disabled:opacity-80',
          isPackageSelected(blankoPackage) ? ui.selectedCard : ui.card,
        ]"
        @click="selectPackage(blankoPackage)"
      >
        <div class="flex h-16 w-10 items-center justify-center overflow-hidden">
          <StripCanvasPreview
            compact
            :layout="packagePreviewLayout(blankoPackage)"
            :template-config="blankoPackage.template"
            class="pointer-events-none"
          />
        </div>
        <span class="text-stc-text text-[13px] font-medium">{{ blankoPackage.template.name }}</span>
      </button>
    </div>

    <div class="flex items-center justify-between gap-3">
      <p class="text-stc-text shrink-0 text-[13px] font-medium">Foto</p>
      <div :class="ui.segmented">
        <button
          v-for="layout in layoutOptions"
          :key="layout.id"
          type="button"
          :disabled="disabled"
          :aria-label="`${selectedTemplateName} ${layout.slotCount} foto`"
          :class="[ui.segmentedItem, isLayoutSelected(layout) ? ui.segmentedItemActive : '']"
          @click="selectLayoutCount(layout)"
        >
          {{ layout.slotCount }}
        </button>
      </div>
    </div>

    <div class="flex items-center justify-between gap-3">
      <p class="text-stc-text shrink-0 text-[13px] font-medium">Timer</p>
      <div :class="ui.segmented">
        <button
          v-for="time in BOOTH_COUNTDOWN_SECONDS"
          :key="time"
          type="button"
          :disabled="disabled"
          :class="[ui.segmentedItem, countdownSeconds === time ? ui.segmentedItemActive : '']"
          @click="selectCountdown(time)"
        >
          {{ time }}s
        </button>
      </div>
    </div>
  </div>
</template>
