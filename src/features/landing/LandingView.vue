<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAppStore, useCapabilityStore } from '@/stores'

const router = useRouter()
const appStore = useAppStore()
const capabilityStore = useCapabilityStore()
const showcaseImages = [
  {
    src: '/images/1759243291185.png',
    alt: 'Photo strip classic preview',
    wrapperClass:
      'absolute z-10 -rotate-[12deg] lg:-translate-x-[78px] xl:-translate-x-[112px] translate-y-6 opacity-90',
    imageClass: 'w-[148px] md:w-[176px]',
    mobileWrapperClass:
      'absolute bottom-5 left-1/2 z-10 -translate-x-[112px] rotate-[-11deg] opacity-90',
    mobileImageClass: 'w-[128px]',
  },
  {
    src: '/images/1769149454852.png',
    alt: 'Photo strip mono preview',
    wrapperClass:
      'absolute z-10 rotate-[12deg] lg:translate-x-[78px] xl:translate-x-[112px] translate-y-12 opacity-90',
    imageClass: 'w-[144px] md:w-[170px]',
    mobileWrapperClass:
      'absolute bottom-4 left-1/2 z-10 translate-x-[6px] rotate-[10deg] opacity-90',
    mobileImageClass: 'w-[124px]',
  },
  {
    src: '/images/1770039834020.png',
    alt: 'Photo strip youth preview',
    wrapperClass: 'absolute z-20',
    imageClass: 'w-[204px]',
    mobileWrapperClass: 'absolute bottom-0 left-1/2 z-20 -translate-x-1/2',
    mobileImageClass: 'w-[172px]',
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
  <div class="bg-stc-bg relative flex min-h-dvh flex-1 flex-col overflow-hidden font-sans">
    <!-- Navigation -->
    <nav class="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-8">
      <div class="flex items-center gap-2">
        <img class="block h-auto w-[132px]" src="/icons.svg" alt="Stecute" />
      </div>
      <div class="flex items-center gap-3">
        <button
          class="border-stc-border text-stc-text shadow-stc-xs hover:bg-stc-bg-2 hidden min-h-11 rounded-xl border bg-white px-5 py-2.5 text-sm font-semibold transition-colors duration-150 md:flex"
          @click="startWithUpload"
        >
          Upload Lokal
        </button>
        <button
          class="border-stc-border text-stc-text-soft shadow-stc-xs hover:bg-stc-bg-2 hover:text-stc-pink flex size-11 items-center justify-center rounded-xl border bg-white transition-colors duration-150"
          @click="router.push('/gallery')"
          title="Galeri"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
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

    <!-- Hero Section -->
    <main
      class="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col items-center gap-10 px-6 pt-12 pb-24 md:pt-20 md:pb-32 lg:flex-row lg:gap-24"
    >
      <!-- Hero Left: Copy & Actions -->
      <div class="flex w-full flex-1 flex-col items-center text-center lg:items-start lg:text-left">
        <!-- Headline -->
        <h1
          class="text-stc-text mb-6 text-5xl leading-[1.1] font-bold tracking-tight md:text-6xl lg:text-[4.5rem]"
        >
          Abadikan Momen,<br />
          <span class="text-stc-pink">Langsung Simpan.</span>
        </h1>

        <!-- Subtitle -->
        <p
          class="text-stc-text-soft mb-10 max-w-2xl text-lg leading-relaxed font-medium lg:max-w-md"
        >
          Photo booth digital premium di perangkat kamu. Lengkap dengan format strip realistis,
          hasil rapi, dan privasi penuh.
          {{ appStore.offlineMode ? '100% Offline.' : 'Siap Offline.' }}
        </p>

        <!-- CTA Buttons -->
        <div class="flex w-full flex-col items-center gap-4 sm:w-auto sm:flex-row">
          <button
            class="bg-stc-pink shadow-stc-sm hover:bg-stc-pink-strong w-full rounded-xl px-8 py-4 text-lg font-bold text-white transition-colors duration-150 sm:w-auto"
            @click="startWithCamera"
          >
            Mulai Foto
          </button>
          <!-- Mobile only secondary actions, since desktop has them in nav -->
          <div class="mt-2 flex w-full gap-3 sm:hidden">
            <button
              class="border-stc-border text-stc-text shadow-stc-xs hover:bg-stc-bg-2 flex-1 rounded-xl border bg-white px-6 py-3.5 text-sm font-bold transition-colors duration-150"
              @click="startWithUpload"
            >
              Upload Lokal
            </button>
          </div>
        </div>
        <!-- Feature Ticks -->
        <div
          class="text-stc-text-soft mt-12 flex w-full flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm font-medium lg:justify-start"
        >
          <div class="flex items-center gap-1.5">
            <svg
              class="text-stc-success h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="3"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Tanpa Login
          </div>
          <div class="flex items-center gap-1.5">
            <svg
              class="text-stc-success h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="3"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Privasi Terjaga
          </div>
          <div class="flex items-center gap-1.5">
            <svg
              class="text-stc-success h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="3"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Hasil Lokal
          </div>
        </div>
      </div>

      <div class="pointer-events-none mt-12 flex w-full justify-center lg:hidden">
        <div class="relative h-[430px] w-full max-w-[320px]">
          <div
            v-for="image in showcaseImages"
            :key="`${image.src}-mobile`"
            :class="image.mobileWrapperClass"
          >
            <img
              :src="image.src"
              :alt="image.alt"
              loading="lazy"
              :class="[
                image.mobileImageClass,
                'shadow-stc-sm block rounded-2xl border-4 border-white bg-white',
              ]"
            />
          </div>
        </div>
      </div>

      <!-- Hero Right: Visual Composition -->
      <div
        class="pointer-events-none relative isolate mt-8 hidden h-[550px] w-full max-w-[500px] flex-1 items-center justify-center [perspective:1000px] lg:mt-0 lg:flex"
      >
        <div v-for="image in showcaseImages" :key="image.src" :class="image.wrapperClass">
          <img
            :src="image.src"
            :alt="image.alt"
            loading="lazy"
            :class="[
              image.imageClass,
              'shadow-stc-sm block rounded-2xl border-4 border-white bg-white',
            ]"
          />
        </div>
      </div>
    </main>
  </div>
</template>
