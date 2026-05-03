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

const framePaddingClass = computed(() =>
  props.variant === 'default' ? 'p-3' : props.variant === 'mini' ? 'p-2.5' : 'p-2',
)

const outerRadiusClass = computed(() => (props.variant === 'default' ? 'rounded-xl' : 'rounded-lg'))

const slotRadiusClass = computed(() => (props.variant === 'gallery' ? 'rounded-md' : 'rounded-lg'))

const slotAspectRatio = computed(() => '4 / 3')

const containerShadowClass = computed(() =>
  props.variant === 'gallery' ? 'shadow-stc-xs' : 'shadow-stc-sm',
)
</script>

<template>
  <article
    class="border-stc-border border"
    :class="[outerRadiusClass, containerShadowClass]"
    :style="{ backgroundColor: background }"
  >
    <div
      v-if="title || badge"
      class="flex items-center justify-between px-4 pt-3 pb-2"
      :class="variant === 'gallery' ? 'px-3 pt-2.5 pb-1.5' : ''"
    >
      <span class="text-stc-text-soft text-[11px] font-semibold uppercase">
        {{ title }}
      </span>
      <span
        v-if="badge"
        class="bg-stc-pink-soft text-stc-pink rounded-lg px-2.5 py-1 text-[10px] font-semibold"
      >
        {{ badge }}
      </span>
    </div>

    <div :class="framePaddingClass">
      <div
        class="overflow-hidden rounded-lg border border-white/70"
        :style="{ backgroundColor: frameColor }"
      >
        <div class="p-2.5" :class="variant === 'gallery' ? 'p-2' : ''">
          <div class="bg-stc-bg-2 flex flex-col gap-2">
            <div
              v-for="index in slotCount"
              :key="index"
              class="relative overflow-hidden border border-white/60"
              :class="slotRadiusClass"
              :style="{
                aspectRatio: slotAspectRatio,
                backgroundColor: placeholderTones[(index - 1) % placeholderTones.length],
              }"
            >
              <span
                v-if="showNumbers"
                class="text-stc-text absolute top-2 left-2 inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-white/90 px-1.5 text-[10px] font-semibold"
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
      class="text-stc-text-soft px-4 pb-3 text-center text-[10px] font-semibold uppercase"
      :class="variant === 'gallery' ? 'px-3 pb-2.5 text-[9px]' : ''"
    >
      {{ footer }}
    </div>
  </article>
</template>
