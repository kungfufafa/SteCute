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
      'absolute z-10 -rotate-[12deg] lg:-translate-x-[78px] xl:-translate-x-[112px] translate-y-6 opacity-80 transition-all duration-500 ease-out hover:-translate-y-2 hover:-rotate-6 hover:opacity-100',
    imageClass: 'w-[148px] md:w-[176px]',
    mobileWrapperClass:
      'absolute bottom-5 left-1/2 z-10 -translate-x-[112px] rotate-[-11deg] opacity-90',
    mobileImageClass: 'w-[128px]',
  },
  {
    src: '/images/1769149454852.png',
    alt: 'Photo strip mono preview',
    wrapperClass:
      'absolute z-10 rotate-[12deg] lg:translate-x-[78px] xl:translate-x-[112px] translate-y-12 opacity-80 transition-all duration-500 ease-out hover:-translate-y-2 hover:rotate-6 hover:opacity-100',
    imageClass: 'w-[144px] md:w-[170px]',
    mobileWrapperClass:
      'absolute bottom-4 left-1/2 z-10 translate-x-[6px] rotate-[10deg] opacity-90',
    mobileImageClass: 'w-[124px]',
  },
  {
    src: '/images/1770039834020.png',
    alt: 'Photo strip youth preview',
    wrapperClass:
      'absolute z-20 transition-all duration-500 ease-out hover:-translate-y-6 hover:scale-105 drop-shadow-[0_25px_35px_rgba(244,91,141,0.25)]',
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
  <div class="relative flex min-h-dvh flex-1 flex-col overflow-hidden bg-stc-bg font-sans">
    <!-- Ambient Background Glows -->
    <div
      class="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-stc-pink/15 blur-[100px] pointer-events-none"
    ></div>
    <div
      class="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-stc-blue/10 blur-[120px] pointer-events-none"
    ></div>

    <!-- Navigation -->
    <nav class="w-full max-w-7xl mx-auto px-6 py-8 flex justify-between items-center relative z-10">
      <div class="flex items-center gap-2">
        <img class="block w-[132px] h-auto" src="/icons.svg" alt="Stecute" />
      </div>
      <div class="flex items-center gap-3">
        <button
          class="hidden md:flex px-5 py-2.5 rounded-full bg-white border border-stc-border shadow-sm text-sm font-semibold text-stc-text hover:bg-stc-bg-2 transition-colors"
          @click="startWithUpload"
        >
          Upload Lokal
        </button>
        <button
          class="flex items-center justify-center w-11 h-11 rounded-full bg-white border border-stc-border shadow-sm text-stc-text-soft hover:bg-stc-bg-2 hover:text-stc-pink transition-all"
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
      class="w-full max-w-7xl mx-auto px-6 pt-12 pb-24 md:pt-20 md:pb-32 flex flex-col lg:flex-row items-center gap-10 lg:gap-24 relative z-10 flex-1"
    >
      <!-- Hero Left: Copy & Actions -->
      <div class="flex-1 flex flex-col items-center text-center lg:items-start lg:text-left w-full">
        <!-- Headline -->
        <h1
          class="text-5xl md:text-6xl lg:text-[4.5rem] font-black text-stc-text tracking-tight leading-[1.1] mb-6"
        >
          Abadikan Momen,<br />
          <span class="text-transparent bg-clip-text bg-linear-to-r from-stc-pink to-rose-400">
            Langsung Simpan.
          </span>
        </h1>

        <!-- Subtitle -->
        <p class="text-lg text-stc-text-soft leading-relaxed mb-10 max-w-2xl lg:max-w-md font-medium">
          Photo booth digital premium di perangkat kamu. Lengkap dengan format strip realistis,
          template keren, dan privasi penuh.
          {{ appStore.offlineMode ? '100% Offline.' : 'Siap Offline.' }}
        </p>

        <!-- CTA Buttons -->
        <div class="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <button
            class="w-full sm:w-auto px-8 py-4 bg-stc-pink text-white rounded-full text-lg font-bold shadow-[0_8px_32px_rgba(244,91,141,0.35)] hover:shadow-[0_12px_40px_rgba(244,91,141,0.5)] hover:-translate-y-1 transition-all duration-300"
            @click="startWithCamera"
          >
            Mulai Foto
          </button>
          <!-- Mobile only secondary actions, since desktop has them in nav -->
          <div class="flex sm:hidden w-full gap-3 mt-2">
            <button
              class="flex-1 px-6 py-3.5 bg-white text-stc-text rounded-full text-sm font-bold border border-stc-border shadow-sm hover:bg-stc-bg-2 transition-colors"
              @click="startWithUpload"
            >
              Upload Lokal
            </button>
          </div>
        </div>
        <!-- Feature Ticks -->
        <div
          class="mt-12 flex w-full flex-nowrap items-center justify-center gap-x-6 gap-y-3 text-sm font-medium text-stc-text-soft lg:justify-start"
        >
          <div class="flex items-center gap-1.5">
            <svg class="w-4 h-4 text-stc-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Tanpa Login
          </div>
          <div class="flex items-center gap-1.5">
            <svg class="w-4 h-4 text-stc-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Privasi Terjaga
          </div>
          <div class="flex items-center gap-1.5">
            <svg class="w-4 h-4 text-stc-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Auto Save
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
                'block rounded-[28px] border-[6px] border-white bg-white shadow-2xl shadow-stc-text/10',
              ]"
            />
          </div>
        </div>
      </div>

      <!-- Hero Right: Visual Composition -->
      <div
        class="pointer-events-none isolate relative mt-8 hidden h-[550px] w-full max-w-[500px] flex-1 items-center justify-center [perspective:1000px] lg:flex lg:mt-0"
      >
        <!-- Center Floating Glow -->
        <div class="absolute inset-0 z-0 m-auto h-3/4 w-3/4 rounded-full bg-white/40 blur-[60px]"></div>

        <div
          v-for="image in showcaseImages"
          :key="image.src"
          :class="image.wrapperClass"
        >
          <img
            :src="image.src"
            :alt="image.alt"
            loading="lazy"
            :class="[
              image.imageClass,
              'block rounded-[28px] border-[6px] border-white bg-white shadow-2xl shadow-stc-text/10',
            ]"
          />
        </div>
      </div>
    </main>
  </div>
</template>
