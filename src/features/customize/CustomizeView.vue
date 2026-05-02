<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { FRAME_COLORS, FILTERS, STICKER_CATEGORIES } from '@/services/decoration'
import { useCustomizeStore, useSessionStore } from '@/stores'
import { ui } from '@/ui/styles'
import { getLayoutById } from '@/layouts'

const router = useRouter()
const sessionStore = useSessionStore()
const customizeStore = useCustomizeStore()
const activeLayout = getLayoutById(sessionStore.layoutId)

const activeTab = ref<'filter' | 'frame' | 'sticker' | 'text'>('filter')
const miniColors = ['#fde8f0', '#fef3c7', '#dbeafe', '#ccfbf1', '#ede9fe', '#fee2e2']

const stickerOptions = STICKER_CATEGORIES.map((category, index) => ({
  id: `${category.id}-starter`,
  label: category.name,
  symbol: ['♥', '★', '✿', '✦', '❋', '☻'][index % 6],
  color: ['#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#22c55e', '#3b82f6'][index % 6],
}))

const visibleFilters = computed(() => FILTERS.slice(0, 9))
const tabs = [
  { id: 'filter', label: 'Filter', icon: '⛃' },
  { id: 'frame', label: 'Frame', icon: '▣' },
  { id: 'sticker', label: 'Sticker', icon: '★' },
  { id: 'text', label: 'Teks', icon: '✎' },
] as const

function goBack() {
  router.push('/review')
}

function proceed() {
  router.push('/render')
}

function filterPreview(filterId: string) {
  if (filterId === 'bw') return 'linear-gradient(135deg,#ccc,#666)'
  if (filterId === 'warm') return 'linear-gradient(135deg,#fde68a,#f59e0b)'
  if (filterId === 'cool') return 'linear-gradient(135deg,#bfdbfe,#60a5fa)'
  if (filterId === 'vintage') return 'linear-gradient(135deg,#d4a574,#a0764a)'
  if (filterId === 'fade') return 'linear-gradient(135deg,#e0e7ff,#a5b4fc)'
  if (filterId === 'film') return 'linear-gradient(135deg,#bbf7d0,#4ade80)'
  if (filterId === 'rosy') return 'linear-gradient(135deg,#fecdd3,#fda4af)'

  return 'linear-gradient(135deg,#f5e6d3,#e8d0b3)'
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
          <h3 :class="ui.title">Kustomisasi</h3>
          <p :class="ui.subtitle">Atur filter, frame, sticker, dan teks sebelum render.</p>
        </div>
      </div>
      <span :class="ui.badge">{{ activeLayout?.printFormat.paperSize ?? `${sessionStore.slotCount} Foto` }}</span>
    </div>

    <div :class="ui.content">
      <div :class="[ui.contentWrap, 'gap-5']">
        <div class="flex justify-center sm:justify-start">
          <div class="w-32 overflow-hidden rounded-[24px] border border-stc-border bg-white shadow-stc-sm">
            <div
              :class="[
                'grid grid-cols-1 gap-1 bg-stc-bg-2 p-2',
              ]"
            >
              <div
                v-for="index in sessionStore.slotCount"
                :key="index"
                class="h-10 rounded-xl"
                :style="{ background: miniColors[(index - 1) % miniColors.length] }"
              ></div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            :class="[
              'rounded-2xl border px-3 py-3 text-center shadow-stc-sm transition-all duration-200',
              activeTab === tab.id
                ? 'border-stc-pink bg-stc-pink text-white shadow-[0_14px_32px_rgba(244,91,141,0.24)]'
                : 'border-stc-border bg-white text-stc-text-faint hover:-translate-y-0.5 hover:bg-stc-bg-2',
            ]"
            :aria-label="tab.label"
            @click="activeTab = tab.id"
          >
            <span class="block text-base">{{ tab.icon }}</span>
            <span class="mt-1 block text-xs font-semibold">{{ tab.label }}</span>
          </button>
        </div>

        <div class="flex-1">
          <div v-if="activeTab === 'filter'" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <button
              v-for="filter in visibleFilters"
              :key="filter.id"
              :class="[
                'overflow-hidden rounded-[24px] border shadow-stc-sm transition-all duration-200 hover:-translate-y-0.5',
                customizeStore.activeFilterId === filter.id
                  ? 'border-stc-pink bg-stc-pink-soft shadow-[0_14px_32px_rgba(244,91,141,0.16)]'
                  : 'border-stc-border bg-white hover:bg-stc-bg-2',
              ]"
              @click="customizeStore.setFilter(filter.id)"
            >
              <div class="aspect-square w-full" :style="{ background: filterPreview(filter.id) }"></div>
              <div
                class="px-3 py-3 text-center text-xs font-semibold"
                :class="
                  customizeStore.activeFilterId === filter.id ? 'text-stc-pink' : 'text-stc-text-faint'
                "
              >
                {{ filter.name }}
              </div>
            </button>
          </div>

          <div v-else-if="activeTab === 'frame'" class="space-y-4">
            <div class="space-y-1">
              <p :class="ui.sectionLabel">Frame</p>
              <h4 class="text-base font-semibold text-stc-text">Warna frame</h4>
            </div>

            <div class="flex flex-wrap gap-3">
              <button
                v-for="color in FRAME_COLORS"
                :key="color.id"
                :class="[
                  'relative size-11 rounded-full border-4 shadow-stc-sm transition-all duration-200 hover:-translate-y-0.5',
                  customizeStore.frameColor === color.value ? 'border-stc-text' : 'border-stc-border',
                ]"
                :style="{ background: color.value }"
                @click="customizeStore.setFrameColor(color.value)"
              >
                <span
                  v-if="customizeStore.frameColor === color.value"
                  class="absolute inset-0 m-auto size-3 rounded-full border border-white/80 bg-white/70"
                ></span>
              </button>
            </div>
          </div>

          <div v-else-if="activeTab === 'sticker'" class="space-y-4">
            <div class="space-y-1">
              <p :class="ui.sectionLabel">Sticker</p>
              <h4 class="text-base font-semibold text-stc-text">Starter pack</h4>
            </div>

            <div class="grid grid-cols-4 gap-3 sm:grid-cols-5">
              <button
                v-for="sticker in stickerOptions"
                :key="sticker.id"
                :class="[
                  'aspect-square rounded-[20px] border bg-white shadow-stc-sm transition-all duration-200 hover:-translate-y-0.5',
                  customizeStore.selectedStickerIds.includes(sticker.id)
                    ? 'border-stc-pink bg-stc-pink-soft'
                    : 'border-stc-border hover:bg-stc-bg-2',
                ]"
                :style="{ color: sticker.color, fontSize: '28px', fontWeight: '700' }"
                @click="customizeStore.toggleSticker(sticker.id)"
              >
                {{ sticker.symbol }}
              </button>
            </div>
          </div>

          <div v-else class="space-y-5">
            <div class="rounded-[24px] border border-stc-border bg-white p-4 shadow-stc-sm">
              <div class="flex items-center justify-between gap-4">
                <div>
                  <div class="text-sm font-semibold text-stc-text">Tanggal & Waktu</div>
                  <div class="mt-1 text-xs text-stc-text-faint">Tampilkan cap waktu di strip</div>
                </div>
                <button
                  :class="[
                    'relative inline-flex h-7 w-12 rounded-full transition-colors duration-200',
                    customizeStore.showDateTime ? 'bg-stc-pink' : 'bg-stc-border-strong',
                  ]"
                  @click="customizeStore.setDateTime(!customizeStore.showDateTime)"
                >
                  <span
                    :class="[
                      'absolute top-1 size-5 rounded-full bg-white shadow-sm transition-transform duration-200',
                      customizeStore.showDateTime ? 'translate-x-6' : 'translate-x-1',
                    ]"
                  ></span>
                </button>
              </div>
            </div>

            <div class="space-y-2">
              <label class="text-sm font-semibold text-stc-text" for="logo-text">Teks Logo</label>
              <input
                id="logo-text"
                class="min-h-12 w-full rounded-2xl border border-stc-border bg-white px-4 py-3 text-sm text-stc-text shadow-stc-sm outline-none transition-all duration-200 placeholder:text-stc-text-faint focus:border-stc-pink focus:ring-4 focus:ring-stc-pink/10"
                type="text"
                :value="customizeStore.logoText"
                maxlength="24"
                placeholder="Contoh: Wedding Agus & Sari"
                @input="customizeStore.setLogoText(($event.target as HTMLInputElement).value)"
              />
            </div>
          </div>
        </div>

        <div class="mt-auto pb-2">
          <button :class="[ui.primaryButton, 'w-full sm:w-auto sm:min-w-56']" @click="proceed">
            Simpan Hasil
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
