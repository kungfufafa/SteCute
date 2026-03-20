<script setup lang="ts">
import { computed } from 'vue'

type StripVariant = 'default' | 'mini' | 'gallery'

const props = withDefaults(
  defineProps<{
    slotCount: number
    title?: string
    badge?: string
    footer?: string
    background?: string
    frameColor?: string
    variant?: StripVariant
    showNumbers?: boolean
  }>(),
  {
    title: '',
    badge: '',
    footer: '',
    background: '#fffdf8',
    frameColor: '#ffffff',
    variant: 'default',
    showNumbers: true,
  },
)

const placeholderTones = ['#fde8f0', '#fef3c7', '#dbeafe', '#ccfbf1', '#ede9fe', '#fee2e2']

const isCompact = computed(() => props.variant !== 'default')

const framePaddingClass = computed(() =>
  props.variant === 'default' ? 'p-3' : props.variant === 'mini' ? 'p-2.5' : 'p-2',
)

const outerRadiusClass = computed(() =>
  props.variant === 'default' ? 'rounded-[28px]' : 'rounded-[24px]',
)

const slotRadiusClass = computed(() =>
  props.variant === 'gallery' ? 'rounded-[12px]' : 'rounded-[14px]',
)

const slotAspectRatio = computed(() => {
  if (props.slotCount <= 2) return isCompact.value ? '3 / 4.8' : '3 / 5.2'
  if (props.slotCount === 3) return isCompact.value ? '3 / 3.3' : '3 / 3.6'
  if (props.slotCount === 4) return isCompact.value ? '3 / 2.4' : '3 / 2.7'
  return isCompact.value ? '3 / 1.7' : '3 / 1.9'
})

const containerShadowClass = computed(() =>
  props.variant === 'gallery'
    ? 'shadow-[0_12px_28px_rgba(26,26,46,0.08)]'
    : 'shadow-[0_18px_46px_rgba(26,26,46,0.12)]',
)
</script>

<template>
  <article
    class="border border-[var(--stc-border)]"
    :class="[outerRadiusClass, containerShadowClass]"
    :style="{ backgroundColor: background }"
  >
    <div
      v-if="title || badge"
      class="flex items-center justify-between px-4 pt-3 pb-2"
      :class="variant === 'gallery' ? 'px-3 pt-2.5 pb-1.5' : ''"
    >
      <span
        class="text-[11px] font-semibold tracking-[0.2em] text-[var(--stc-text-soft)] uppercase"
      >
        {{ title }}
      </span>
      <span
        v-if="badge"
        class="rounded-full px-2.5 py-1 text-[10px] font-semibold"
        style="
          background-color: color-mix(in srgb, var(--stc-pink) 12%, white);
          color: var(--stc-pink);
        "
      >
        {{ badge }}
      </span>
    </div>

    <div :class="framePaddingClass">
      <div
        class="overflow-hidden rounded-[20px] border border-white/70"
        :class="variant === 'gallery' ? 'rounded-[18px]' : ''"
        :style="{ backgroundColor: frameColor }"
      >
        <div class="p-2.5" :class="variant === 'gallery' ? 'p-2' : ''">
          <div
            class="flex flex-col gap-2"
            :style="{ backgroundColor: 'color-mix(in srgb, white 82%, var(--stc-bg-3))' }"
          >
            <div
              v-for="index in slotCount"
              :key="index"
              class="relative overflow-hidden border border-white/60"
              :class="slotRadiusClass"
              :style="{
                aspectRatio: slotAspectRatio,
                background: `linear-gradient(135deg, ${placeholderTones[(index - 1) % placeholderTones.length]}, color-mix(in srgb, ${placeholderTones[(index - 1) % placeholderTones.length]} 55%, white))`,
              }"
            >
              <div
                class="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.9),transparent_45%)]"
              ></div>
              <div
                class="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.3))]"
              ></div>
              <span
                v-if="showNumbers"
                class="absolute top-2 left-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[rgba(255,255,255,0.88)] px-1.5 text-[10px] font-semibold text-[var(--stc-text)]"
                :class="variant === 'gallery' ? 'h-5 min-w-5 text-[9px]' : ''"
              >
                {{ index }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="footer"
      class="px-4 pb-3 text-center text-[10px] font-semibold tracking-[0.18em] text-[var(--stc-text-soft)] uppercase"
      :class="variant === 'gallery' ? 'px-3 pb-2.5 text-[9px]' : ''"
    >
      {{ footer }}
    </div>
  </article>
</template>
