<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { CAMERA_EFFECTS, getCameraEffectById } from '@/services/camera-effects'
import { PHOTO_FILTERS, getPhotoFilterById } from '@/services/filter'
import { ui } from '@/ui/styles'
import DecorationSwatch from '@/components/common/DecorationSwatch.vue'
import VirtualBackgroundPicker from '@/components/common/VirtualBackgroundPicker.vue'

const props = withDefaults(
  defineProps<{
    filterId: string
    cameraEffectId: string
    virtualBackgroundId?: string
    disabled?: boolean
    kind?: 'filter' | 'overlay' | 'background' | 'all'
    stacked?: boolean
  }>(),
  {
    kind: 'all',
    stacked: false,
    virtualBackgroundId: 'off',
  },
)

const emit = defineEmits<{
  selectFilter: [filterId: string]
  selectEffect: [effectId: string]
  selectBackground: [backgroundId: string]
  customFile: [file: File]
}>()

const FILTER_INLINE_LIMIT = 4
const CAMERA_EFFECT_INLINE_LIMIT = 5
const activeOptionPicker = ref<'filter' | 'overlay' | null>(null)

function getInlineOptions<T extends { id: string }>(
  options: T[],
  limit: number,
  selectedId: string,
): T[] {
  if (options.length <= limit) return options
  const initialOptions = options.slice(0, limit)
  if (initialOptions.some((option) => option.id === selectedId)) return initialOptions
  const selectedOption = options.find((option) => option.id === selectedId)
  if (!selectedOption) return initialOptions
  return [...options.slice(0, limit - 1), selectedOption]
}

function getHiddenOptions<T extends { id: string }>(options: T[], visibleOptions: T[]): T[] {
  const visibleIds = new Set(visibleOptions.map((option) => option.id))
  return options.filter((option) => !visibleIds.has(option.id))
}

const inlineFilterOptions = computed(() =>
  getInlineOptions(PHOTO_FILTERS, FILTER_INLINE_LIMIT, props.filterId),
)
const hiddenFilterOptions = computed(() =>
  getHiddenOptions(PHOTO_FILTERS, inlineFilterOptions.value),
)
const inlineCameraEffectOptions = computed(() =>
  getInlineOptions(CAMERA_EFFECTS, CAMERA_EFFECT_INLINE_LIMIT, props.cameraEffectId),
)
const hiddenCameraEffectOptions = computed(() =>
  getHiddenOptions(CAMERA_EFFECTS, inlineCameraEffectOptions.value),
)

function filterSwatchStyle(filterId: string) {
  const filter = getPhotoFilterById(filterId)
  return {
    background: filter.previewBackground,
    filter: filter.cssFilter,
  }
}

function cameraEffectSwatchStyle(effectId: string) {
  const effect = getCameraEffectById(effectId)
  return {
    background: effect.thumbnail ? 'transparent' : effect.previewBackground,
  }
}

function chipLabel(option: { label: string; shortLabel?: string }) {
  return option.shortLabel ?? option.label
}

function selectFilter(filterId: string) {
  if (props.disabled && filterId !== props.filterId) return
  emit('selectFilter', filterId)
  activeOptionPicker.value = null
}

function selectEffect(effectId: string) {
  if (props.disabled && effectId !== props.cameraEffectId) return
  emit('selectEffect', effectId)
  activeOptionPicker.value = null
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') activeOptionPicker.value = null
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div
    :class="['flex min-w-0 gap-4', stacked ? 'flex-col' : 'flex-col sm:flex-row sm:items-start']"
  >
    <div v-if="kind === 'filter' || kind === 'all'">
      <p :class="[ui.sectionLabel, 'mb-1.5']">Efek</p>
      <div :class="['flex gap-2 pb-1', stacked ? 'flex-wrap' : 'overflow-x-auto']">
        <DecorationSwatch
          v-for="filter in inlineFilterOptions"
          :key="filter.id"
          :label="chipLabel(filter)"
          :accessible-label="`Pilih efek ${filter.label}`"
          :title="filter.label"
          :selected="filter.id === filterId"
          :disabled="disabled && filter.id !== filterId"
          @click="selectFilter(filter.id)"
        >
          <span class="block size-full" :style="filterSwatchStyle(filter.id)"></span>
        </DecorationSwatch>
        <DecorationSwatch
          v-if="hiddenFilterOptions.length > 0"
          accessible-label="Buka semua efek"
          title="Semua efek"
          @click="activeOptionPicker = 'filter'"
        >
          <span
            class="text-stc-pink bg-stc-bg-2 flex size-full items-center justify-center text-lg font-semibold"
            aria-hidden="true"
          >
            +
          </span>
        </DecorationSwatch>
      </div>
    </div>

    <div v-if="kind === 'overlay' || kind === 'all'">
      <p :class="[ui.sectionLabel, 'mb-1.5']">Overlay</p>
      <div :class="['flex gap-2 pb-1', stacked ? 'flex-wrap' : 'overflow-x-auto']">
        <DecorationSwatch
          v-for="effect in inlineCameraEffectOptions"
          :key="effect.id"
          :label="chipLabel(effect)"
          :accessible-label="`Pilih overlay ${effect.label}`"
          :title="effect.description"
          :selected="effect.id === cameraEffectId"
          :disabled="disabled && effect.id !== cameraEffectId"
          @click="selectEffect(effect.id)"
        >
          <span class="relative block size-full" :style="cameraEffectSwatchStyle(effect.id)">
            <img
              v-if="effect.thumbnail"
              :src="effect.thumbnail"
              alt=""
              class="h-full w-full object-contain p-1.5"
            />
          </span>
        </DecorationSwatch>
        <DecorationSwatch
          v-if="hiddenCameraEffectOptions.length > 0"
          accessible-label="Buka semua overlay"
          title="Semua overlay"
          @click="activeOptionPicker = 'overlay'"
        >
          <span
            class="text-stc-pink bg-stc-bg-2 flex size-full items-center justify-center text-lg font-semibold"
            aria-hidden="true"
          >
            +
          </span>
        </DecorationSwatch>
      </div>
    </div>

    <VirtualBackgroundPicker
      v-if="kind === 'background' || kind === 'all'"
      :background-id="virtualBackgroundId"
      :disabled="disabled"
      :stacked="stacked"
      @select="emit('selectBackground', $event)"
      @custom-file="emit('customFile', $event)"
    />

    <div
      v-if="activeOptionPicker"
      class="fixed inset-0 z-[70] flex items-end justify-center bg-black/35 px-4 py-5 sm:items-center"
      role="dialog"
      aria-modal="true"
      @click.self="activeOptionPicker = null"
    >
      <div
        class="border-stc-border max-h-[min(42rem,calc(100dvh-2.5rem))] w-full max-w-2xl overflow-hidden rounded-lg border bg-white"
      >
        <div class="border-stc-border flex items-center justify-between gap-3 border-b px-4 py-3">
          <p :class="ui.sectionLabel">
            {{ activeOptionPicker === 'filter' ? 'Efek' : 'Overlay' }}
          </p>
          <button
            :class="ui.iconButton"
            type="button"
            aria-label="Tutup"
            @click="activeOptionPicker = null"
          >
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
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div class="max-h-[calc(100dvh-9rem)] overflow-y-auto p-4">
          <div v-if="activeOptionPicker === 'filter'" class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              v-for="filter in PHOTO_FILTERS"
              :key="filter.id"
              type="button"
              :aria-label="`Pilih efek ${filter.label}`"
              :aria-pressed="filter.id === filterId"
              :disabled="disabled && filter.id !== filterId"
              :class="[
                'focus-visible:ring-stc-pink/40 flex min-h-12 min-w-0 flex-row items-center justify-start gap-3 rounded-md border px-3 py-2 text-[13px] font-medium outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-45',
                filter.id === filterId
                  ? 'border-stc-pink bg-stc-bg-2 text-stc-text'
                  : 'border-stc-border text-stc-text-soft hover:bg-stc-bg-2 hover:text-stc-text bg-white',
              ]"
              @click="selectFilter(filter.id)"
            >
              <span
                class="border-stc-border/50 block size-10 shrink-0 rounded-lg border shadow-inner"
                :style="filterSwatchStyle(filter.id)"
              ></span>
              <span class="max-w-full truncate">{{ filter.label }}</span>
            </button>
          </div>
          <div v-else class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              v-for="effect in CAMERA_EFFECTS"
              :key="effect.id"
              type="button"
              :aria-label="`Pilih overlay ${effect.label}`"
              :aria-pressed="effect.id === cameraEffectId"
              :disabled="disabled && effect.id !== cameraEffectId"
              :title="effect.description"
              :class="[
                'focus-visible:ring-stc-pink/40 flex min-h-12 min-w-0 flex-row items-center justify-start gap-3 rounded-md border px-3 py-2 text-[13px] font-medium outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-45',
                effect.id === cameraEffectId
                  ? 'border-stc-pink bg-stc-bg-2 text-stc-text'
                  : 'border-stc-border text-stc-text-soft hover:bg-stc-bg-2 hover:text-stc-text bg-white',
              ]"
              @click="selectEffect(effect.id)"
            >
              <span
                class="border-stc-border/50 relative block size-10 shrink-0 overflow-hidden rounded-lg border shadow-inner"
                :style="cameraEffectSwatchStyle(effect.id)"
              >
                <img
                  v-if="effect.thumbnail"
                  :src="effect.thumbnail"
                  alt=""
                  class="h-full w-full object-contain p-1"
                />
              </span>
              <span class="max-w-full truncate">{{ effect.label }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
