<script setup lang="ts">
import { computed } from 'vue'
import type { LayoutConfig, SlotConfig, TemplateConfig } from '@/db/schema'
import { resolveTemplateLayout } from '@/templates'
import { STECUTE_LOGO_HEIGHT, STECUTE_LOGO_WIDTH } from '@/services/render/logo'
import { getPhotoFilterCss } from '@/services/filter'

const props = withDefaults(
  defineProps<{
    layout: LayoutConfig | null | undefined
    templateConfig: TemplateConfig | null | undefined
    shotUrls?: string[]
    interactive?: boolean
    fitViewport?: boolean
    filterId?: string
  }>(),
  {
    shotUrls: () => [],
    interactive: false,
    fitViewport: false,
    filterId: 'normal',
  },
)

const emit = defineEmits<{
  retake: [index: number]
}>()

const placeholderTones = ['#fde8f0', '#fef3c7', '#dbeafe', '#ccfbf1', '#ede9fe', '#fee2e2']

const previewLayout = computed(() => {
  if (!props.layout || !props.templateConfig) return null
  return resolveTemplateLayout(props.layout, props.templateConfig)
})

const canvasStyle = computed<Record<string, string>>(() => {
  const layout = previewLayout.value
  const template = props.templateConfig

  if (!layout || !template) return {} as Record<string, string>

  return {
    aspectRatio: `${layout.canvas.width} / ${layout.canvas.height}`,
    background: templateBackground(template),
    color: template.textColor,
    '--strip-ratio': String(layout.canvas.width / layout.canvas.height),
  }
})

const blankoImageSrc = computed(() => {
  const template = props.templateConfig
  if (template?.blanko.mode !== 'image') return null
  return template.blanko.backgroundImage
})

const blankoImageStyle = computed<Record<string, string>>(() => {
  const template = props.templateConfig
  const imageFit = template?.blanko.imageFit ?? 'cover'

  return {
    objectFit: imageFit === 'stretch' ? 'fill' : imageFit,
  }
})

const usesBlankoBackgroundImage = computed(
  () => props.templateConfig?.blanko.imageLayer === 'background',
)

const usesBlankoOverlayImage = computed(
  () =>
    props.templateConfig?.blanko.mode === 'image' &&
    props.templateConfig.blanko.imageLayer !== 'background',
)
const photoFilter = computed(() => getPhotoFilterCss(props.filterId))

function percent(value: number, total: number) {
  return `${(value / total) * 100}%`
}

function radiusPercent(radius: number, width: number, height: number) {
  return `${(radius / Math.min(width, height)) * 100}%`
}

function templateBackground(template: TemplateConfig) {
  if (template.id === 'classic') return template.background

  if (template.blanko.pattern === 'gingham') {
    return [
      `repeating-linear-gradient(90deg, color-mix(in srgb, ${template.accentColor} 18%, transparent) 0 8%, transparent 8% 16%)`,
      `repeating-linear-gradient(180deg, color-mix(in srgb, ${template.accentColor} 14%, transparent) 0 8%, transparent 8% 16%)`,
      template.background,
    ].join(', ')
  }

  if (template.blanko.pattern === 'mono') {
    return [
      'repeating-linear-gradient(180deg, transparent 0 5%, rgba(255,255,255,0.08) 5.04% 5.08%, transparent 5.12% 10%)',
      template.background,
    ].join(', ')
  }

  return [
    `repeating-linear-gradient(180deg, transparent 0 4.4%, color-mix(in srgb, ${template.accentColor} 14%, transparent) 4.45% 4.5%, transparent 4.55% 8.9%)`,
    template.background,
  ].join(', ')
}

function backingStyle(slot: SlotConfig) {
  const layout = previewLayout.value
  const template = props.templateConfig
  if (!layout || !template) return {}

  const padding = template.blanko.photoPadding

  return {
    left: percent(slot.x - padding, layout.canvas.width),
    top: percent(slot.y - padding, layout.canvas.height),
    width: percent(slot.width + padding * 2, layout.canvas.width),
    height: percent(slot.height + padding * 2, layout.canvas.height),
    backgroundColor: template.defaultFrameColor,
    borderRadius: radiusPercent(
      template.blanko.photoRadius + padding,
      slot.width + padding * 2,
      slot.height + padding * 2,
    ),
    boxShadow: template.blanko.photoShadow
      ? template.id === 'mono'
        ? '0 6px 14px rgba(0,0,0,0.28)'
        : '0 3px 10px rgba(38,30,24,0.1)'
      : 'none',
  }
}

function slotStyle(slot: SlotConfig, index: number) {
  const layout = previewLayout.value
  if (!layout) return {}

  const fallback = placeholderTones[index % placeholderTones.length]
  const style: Record<string, string> = {
    left: percent(slot.x, layout.canvas.width),
    top: percent(slot.y, layout.canvas.height),
    width: percent(slot.width, layout.canvas.width),
    height: percent(slot.height, layout.canvas.height),
    borderRadius: radiusPercent(slot.radius, slot.width, slot.height),
    backgroundColor: fallback,
  }

  return style
}

function slotPhotoStyle(index: number) {
  const url = props.shotUrls[index]
  const fallback = placeholderTones[index % placeholderTones.length]
  const style: Record<string, string> = {
    backgroundColor: fallback,
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    filter: photoFilter.value,
  }

  if (url) {
    style.backgroundImage = `url("${url}")`
  }

  return style
}

function labelStyle() {
  const layout = previewLayout.value
  const template = props.templateConfig
  if (!layout || !template) return {}

  const horizontal =
    template.label.align === 'left'
      ? percent(90, layout.canvas.width)
      : template.label.align === 'right'
        ? percent(layout.canvas.width - 90, layout.canvas.width)
        : '50%'

  return {
    left: horizontal,
    right: template.label.align === 'right' ? percent(90, layout.canvas.width) : 'auto',
    bottom: percent(120, layout.canvas.height),
    transform: template.label.align === 'center' ? 'translateX(-50%)' : 'none',
    color: template.textColor,
    opacity: template.id === 'mono' ? '0.78' : '0.7',
    textAlign: template.label.align,
    fontSize: `clamp(1rem, ${(template.label.fontSize / layout.canvas.width) * 100}cqw, 1.75rem)`,
  }
}

function footerLogoStyle() {
  const layout = previewLayout.value
  if (!layout) return {}

  const lastSlot = layout.slots[layout.slots.length - 1]
  if (!lastSlot) return {}

  const footerTop = lastSlot.y + lastSlot.height
  const footerHeight = layout.canvas.height - footerTop
  const logoWidth = Math.min(layout.canvas.width * 0.3, 340)
  const logoHeight = logoWidth * (STECUTE_LOGO_HEIGHT / STECUTE_LOGO_WIDTH)
  const y = footerTop + Math.max(0, (footerHeight - logoHeight) / 2)

  return {
    left: '50%',
    top: percent(y, layout.canvas.height),
    width: percent(logoWidth, layout.canvas.width),
    transform: 'translateX(-50%)',
  }
}
</script>

<template>
  <div
    v-if="previewLayout && templateConfig"
    class="strip-canvas-preview border-stc-border shadow-stc-sm [container-type:inline-size] relative overflow-hidden rounded-xl border"
    :class="{ 'strip-canvas-preview--fit': fitViewport }"
    :style="canvasStyle"
  >
    <img
      v-if="blankoImageSrc && usesBlankoBackgroundImage"
      :src="blankoImageSrc"
      alt=""
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 h-full w-full"
      :style="blankoImageStyle"
      decoding="async"
    />

    <div
      v-for="(slot, index) in previewLayout.slots"
      :key="`backing-${index}`"
      class="absolute"
      :style="backingStyle(slot)"
    ></div>

    <template v-for="(slot, index) in previewLayout.slots" :key="`slot-${index}`">
      <button
        v-if="interactive"
        class="group bg-stc-bg-3 hover:ring-stc-pink/35 focus-visible:ring-stc-pink/60 absolute overflow-hidden text-left transition-shadow duration-150 hover:ring-2 focus-visible:ring-2 focus-visible:outline-none"
        :style="slotStyle(slot, index)"
        :aria-label="`Ganti foto ${index + 1}`"
        @click="emit('retake', index)"
      >
        <span
          class="absolute inset-0 bg-cover bg-center bg-no-repeat"
          :style="slotPhotoStyle(index)"
          aria-hidden="true"
        ></span>
        <span
          class="text-stc-text shadow-stc-xs absolute top-2 left-2 inline-flex min-w-7 items-center justify-center rounded-lg bg-white/90 px-2 py-1 text-[10px] font-bold"
        >
          {{ index + 1 }}
        </span>
        <span
          class="bg-stc-text/75 absolute inset-x-0 bottom-0 px-3 py-2 text-xs font-semibold text-white/95 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100"
        >
          {{ shotUrls[index] ? 'Ganti Foto' : `Foto ${index + 1}` }}
        </span>
      </button>

      <div v-else class="bg-stc-bg-3 absolute overflow-hidden" :style="slotStyle(slot, index)">
        <span
          class="absolute inset-0 bg-cover bg-center bg-no-repeat"
          :style="slotPhotoStyle(index)"
          aria-hidden="true"
        ></span>
      </div>
    </template>

    <img
      v-if="blankoImageSrc && usesBlankoOverlayImage"
      :src="blankoImageSrc"
      alt=""
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 h-full w-full"
      :style="blankoImageStyle"
      decoding="async"
    />

    <img
      v-if="templateConfig.footerLogo"
      :src="templateConfig.footerLogo"
      alt="Stecute"
      class="absolute block"
      :style="footerLogoStyle()"
      decoding="async"
    />

    <div
      v-else-if="templateConfig.label.text"
      class="absolute font-bold whitespace-nowrap"
      :style="labelStyle()"
    >
      {{ templateConfig.label.text }}
    </div>
  </div>
</template>

<style scoped>
.strip-canvas-preview {
  width: min(100%, 20rem);
  max-width: 20rem;
}

.strip-canvas-preview--fit {
  width: min(100%, 20rem, calc((100dvh - 17rem) * var(--strip-ratio, 1)));
}

@media (min-width: 768px) {
  .strip-canvas-preview--fit {
    width: min(100%, 22rem, calc((100dvh - 15rem) * var(--strip-ratio, 1)));
    max-width: 22rem;
  }
}

@media (max-height: 720px) and (min-width: 768px) {
  .strip-canvas-preview--fit {
    width: min(100%, 19rem, calc((100dvh - 12rem) * var(--strip-ratio, 1)));
  }
}
</style>
