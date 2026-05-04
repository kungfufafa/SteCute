<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAppStore } from '@/app/store/useAppStore'
import { useCapabilityStore } from '@/app/store/useCapabilityStore'
import { ui } from '@/ui/styles'
import FlowProgress from '@/components/common/FlowProgress.vue'
import PublicLinksFooter from '@/features/public-info/PublicLinksFooter.vue'

const router = useRouter()
const appStore = useAppStore()
const capabilityStore = useCapabilityStore()
const showcaseImages = [
  {
    src: '/images/classic-strip-preview.webp',
    alt: 'Preview strip Classic',
    width: 204,
    height: 612,
    priority: 'low',
    baseClass: 'absolute top-6 -left-2 w-[48%] -rotate-12 hover:-rotate-6 z-10 sm:-left-4 sm:top-8',
  },
  {
    src: '/images/mono-strip-preview.webp',
    alt: 'Preview strip Mono',
    width: 204,
    height: 612,
    priority: 'low',
    baseClass:
      'absolute top-10 -right-2 w-[48%] rotate-12 hover:rotate-6 z-10 sm:-right-4 sm:top-12',
  },
  {
    src: '/images/youth-strip-preview.webp',
    alt: 'Preview strip Youth',
    width: 241,
    height: 723,
    priority: 'low',
    baseClass: 'relative w-[56%] z-20 shadow-stc-lg',
  },
] as const

capabilityStore.detectCapabilities()

function startWithCamera() {
  router.push({ path: '/config', query: { source: 'camera' } })
}

function startWithUpload() {
  router.push({ path: '/config', query: { source: 'upload' } })
}
</script>

<template>
  <div :class="ui.page">
    <nav :class="ui.headerWide">
      <div :class="ui.headerGroup">
        <img
          class="block h-auto w-[116px] md:w-[132px]"
          src="/icons.svg"
          alt="Stecute"
          width="442"
          height="123"
          decoding="async"
        />
      </div>
      <div class="flex items-center gap-3">
        <button
          :class="[ui.secondaryButton, '!hidden !min-h-11 !w-auto !px-5 !py-2.5 !text-sm md:!flex']"
          @click="startWithUpload"
        >
          Upload Lokal
        </button>
        <button
          :class="ui.iconButton"
          aria-label="Buka galeri"
          title="Galeri"
          @click="router.push('/gallery')"
        >
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </button>
      </div>
    </nav>

    <FlowProgress current="landing" />

    <main
      class="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 items-start gap-8 px-4 pt-3 pb-12 sm:px-6 md:px-8 md:pt-6 md:pb-16 lg:grid-cols-[minmax(0,0.95fr)_minmax(340px,1.05fr)] lg:items-center lg:gap-12 xl:gap-16"
    >
      <section class="flex min-w-0 flex-col items-center text-center lg:items-start lg:text-left">
        <p :class="[ui.sectionLabel, 'text-stc-pink mb-3 sm:mb-4']">Photo booth lokal</p>
        <h1
          class="text-stc-text max-w-[11ch] text-[2.75rem] leading-[1.05] font-bold tracking-[0] sm:text-[3.5rem] lg:text-[4rem]"
        >
          Stecute Photo Booth
        </h1>

        <p
          class="text-stc-text-soft mt-6 max-w-[34rem] text-[1rem] leading-relaxed font-medium sm:text-[1.0625rem] lg:max-w-[31rem]"
        >
          Buka kamera, ambil beberapa pose, lalu simpan photo strip langsung di perangkat.
          {{ appStore.offlineMode ? '100% Offline.' : 'Siap Offline.' }}
        </p>

        <div class="mt-9 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
          <button :class="[ui.primaryButton, 'sm:!w-auto']" @click="startWithCamera">
            Mulai Foto
          </button>
          <div class="flex w-full sm:hidden">
            <button :class="ui.secondaryButton" @click="startWithUpload">Upload Lokal</button>
          </div>
        </div>

        <div
          class="mt-8 flex flex-wrap items-center justify-center gap-2.5 sm:mt-10 lg:justify-start"
        >
          <div
            class="text-stc-text-soft shadow-stc-xs ring-stc-border/70 flex items-center gap-1.5 rounded-full bg-white/80 px-3.5 py-2 text-[0.8125rem] font-bold ring-1 backdrop-blur-sm"
          >
            <div
              class="bg-stc-success-soft text-stc-success flex size-5 items-center justify-center rounded-full"
            >
              <svg
                aria-hidden="true"
                class="size-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="4"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            Tanpa Login
          </div>
          <div
            class="text-stc-text-soft shadow-stc-xs ring-stc-border/70 flex items-center gap-1.5 rounded-full bg-white/80 px-3.5 py-2 text-[0.8125rem] font-bold ring-1 backdrop-blur-sm"
          >
            <div
              class="bg-stc-success-soft text-stc-success flex size-5 items-center justify-center rounded-full"
            >
              <svg
                aria-hidden="true"
                class="size-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="4"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            Privasi Terjaga
          </div>
          <div
            class="text-stc-text-soft shadow-stc-xs ring-stc-border/70 flex items-center gap-1.5 rounded-full bg-white/80 px-3.5 py-2 text-[0.8125rem] font-bold ring-1 backdrop-blur-sm"
          >
            <div
              class="bg-stc-success-soft text-stc-success flex size-5 items-center justify-center rounded-full"
            >
              <svg
                aria-hidden="true"
                class="size-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="4"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            Hasil Lokal
          </div>
        </div>
      </section>

      <section
        class="border-stc-border shadow-stc-lg relative mx-auto flex h-[400px] w-full max-w-[560px] flex-col overflow-hidden rounded-xl border bg-white/40 sm:h-[500px]"
        aria-label="Preview Stecute"
      >
        <div class="relative flex-1 overflow-hidden">
          <div
            class="absolute top-6 left-1/2 flex w-[260px] -translate-x-1/2 justify-center sm:top-10 sm:w-[320px]"
          >
            <img
              v-for="image in showcaseImages"
              :key="image.src"
              :src="image.src"
              :alt="image.alt"
              :width="image.width"
              :height="image.height"
              loading="lazy"
              decoding="async"
              :fetchpriority="image.priority"
              :class="[
                image.baseClass,
                'shadow-stc-md rounded-xl border-[4px] border-white bg-white transition-transform duration-500 hover:-translate-y-2',
              ]"
            />
          </div>
        </div>

        <div
          class="border-stc-border bg-stc-bg-2 relative z-30 grid grid-cols-3 border-t px-5 py-4 text-center sm:px-8"
        >
          <div>
            <p :class="ui.sectionLabel">Layout</p>
            <p class="text-stc-text mt-1 text-sm font-bold">2/3/4/6</p>
          </div>
          <div class="border-stc-border border-x">
            <p :class="ui.sectionLabel">Timer</p>
            <p class="text-stc-text mt-1 text-sm font-bold">3-10s</p>
          </div>
          <div>
            <p :class="ui.sectionLabel">Penyimpanan</p>
            <p class="text-stc-text mt-1 text-sm font-bold">Lokal</p>
          </div>
        </div>
      </section>
    </main>

    <PublicLinksFooter />
  </div>
</template>
