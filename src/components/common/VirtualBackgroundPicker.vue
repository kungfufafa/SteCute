<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  VIRTUAL_BACKGROUNDS,
  getVirtualBackgroundById,
} from '@/services/virtual-background'
import { openImagePicker } from '@/services/upload'
import { ui } from '@/ui/styles'

const props = withDefaults(
  defineProps<{
    backgroundId: string
    disabled?: boolean
    stacked?: boolean
  }>(),
  {
    stacked: false,
  },
)

const emit = defineEmits<{
  select: [backgroundId: string]
  customFile: [file: File]
}>()

const INLINE_LIMIT = 5
const pickerOpen = ref(false)

const inlineOptions = computed(() => {
  const preferred = VIRTUAL_BACKGROUNDS.filter((background) =>
    ['off', 'pink', 'blue', 'blur', 'custom'].includes(background.id),
  )
  if (preferred.some((background) => background.id === props.backgroundId)) return preferred
  const selected = VIRTUAL_BACKGROUNDS.find((background) => background.id === props.backgroundId)
  if (!selected) return preferred
  return [...preferred.slice(0, INLINE_LIMIT - 1), selected]
})

const hiddenOptions = computed(() => {
  const visibleIds = new Set(inlineOptions.value.map((background) => background.id))
  return VIRTUAL_BACKGROUNDS.filter((background) => !visibleIds.has(background.id))
})

function swatchStyle(backgroundId: string) {
  const background = getVirtualBackgroundById(backgroundId)
  return { background: background.previewBackground }
}

async function selectBackground(backgroundId: string) {
  if (props.disabled && backgroundId !== props.backgroundId) return

  if (backgroundId === 'custom') {
    const files = await openImagePicker(false)
    const file = files?.[0]
    if (!file) {
      pickerOpen.value = false
      return
    }
    emit('customFile', file)
    pickerOpen.value = false
    return
  }

  emit('select', backgroundId)
  pickerOpen.value = false
}
</script>

<template>
  <div>
    <p :class="[ui.sectionLabel, 'mb-2']">Latar Virtual</p>
    <div
      class="flex gap-2 overflow-x-auto pb-1"
      :class="stacked ? 'lg:grid lg:grid-cols-1 lg:overflow-visible lg:pb-0' : ''"
    >
      <button
        v-for="background in inlineOptions"
        :key="background.id"
        type="button"
        :aria-label="`Pilih latar ${background.label}`"
        :aria-pressed="background.id === backgroundId"
        :disabled="disabled && background.id !== backgroundId"
        :title="background.description"
        :class="[
          'focus-visible:ring-stc-pink/40 flex h-14 w-14 shrink-0 flex-col items-center justify-center gap-1 rounded-md border px-1.5 text-[11px] font-medium outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-45',
          stacked
            ? 'lg:h-auto lg:min-h-12 lg:w-full lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:py-2 lg:text-[13px]'
            : '',
          background.id === backgroundId
            ? 'border-stc-text bg-stc-bg-2 text-stc-text'
            : 'border-stc-border text-stc-text-soft hover:bg-stc-bg-2 hover:text-stc-text bg-white',
        ]"
        @click="selectBackground(background.id)"
      >
        <span
          class="border-stc-border/50 block size-8 rounded-xl border shadow-inner"
          :class="stacked ? 'lg:size-10 lg:shrink-0' : ''"
          :style="swatchStyle(background.id)"
        ></span>
        <span class="max-w-full truncate">{{ background.label }}</span>
      </button>
      <button
        v-if="hiddenOptions.length > 0"
        type="button"
        class="border-stc-border text-stc-text-soft hover:bg-stc-bg-2 hover:text-stc-text focus-visible:ring-stc-pink/40 flex h-14 w-14 shrink-0 flex-col items-center justify-center gap-1 rounded-md border bg-white px-1.5 text-[11px] font-medium outline-none focus-visible:ring-2"
        :class="
          stacked
            ? 'lg:h-auto lg:min-h-12 lg:w-full lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:py-2 lg:text-[13px]'
            : ''
        "
        aria-label="Buka semua latar virtual"
        :disabled="disabled"
        @click="pickerOpen = true"
      >
        <span
          class="border-stc-border/60 bg-stc-bg-2 text-stc-pink flex size-8 items-center justify-center rounded-xl border text-base font-semibold"
          aria-hidden="true"
        >
          +
        </span>
        <span>Lainnya</span>
      </button>
    </div>

    <div
      v-if="pickerOpen"
      class="fixed inset-0 z-[70] flex items-end justify-center bg-black/35 px-4 py-5 sm:items-center"
      role="dialog"
      aria-modal="true"
      @click.self="pickerOpen = false"
    >
      <div
        class="border-stc-border max-h-[min(42rem,calc(100dvh-2.5rem))] w-full max-w-2xl overflow-hidden rounded-lg border bg-white"
      >
        <div class="border-stc-border flex items-center justify-between gap-3 border-b px-4 py-3">
          <p :class="ui.sectionLabel">Latar Virtual</p>
          <button
            :class="ui.iconButton"
            type="button"
            aria-label="Tutup"
            @click="pickerOpen = false"
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
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              v-for="background in VIRTUAL_BACKGROUNDS"
              :key="background.id"
              type="button"
              :aria-label="`Pilih latar ${background.label}`"
              :aria-pressed="background.id === backgroundId"
              :disabled="disabled && background.id !== backgroundId"
              :title="background.description"
              :class="[
                'focus-visible:ring-stc-pink/40 flex min-h-12 min-w-0 flex-row items-center justify-start gap-3 rounded-md border px-3 py-2 text-[13px] font-medium outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-45',
                background.id === backgroundId
                  ? 'border-stc-text bg-stc-bg-2 text-stc-text'
                  : 'border-stc-border text-stc-text-soft hover:bg-stc-bg-2 hover:text-stc-text bg-white',
              ]"
              @click="selectBackground(background.id)"
            >
              <span
                class="border-stc-border/50 block size-10 shrink-0 rounded-xl border shadow-inner"
                :style="swatchStyle(background.id)"
              ></span>
              <span class="max-w-full truncate">{{ background.label }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
