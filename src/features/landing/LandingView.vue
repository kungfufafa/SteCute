<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/app/store/useAppStore'
import { useCapabilityStore } from '@/app/store/useCapabilityStore'
import { useSessionStore } from '@/app/store/useSessionStore'
import { abandonIncompleteSession } from '@/services/session'
import { clearPendingSessionConfig } from '@/services/session/persist'
import { promptPwaInstall } from '@/services/pwa/install'
import { requestPersistentStorage } from '@/services/storage'
import { ui } from '@/ui/styles'
import PublicLinksFooter from '@/features/public-info/PublicLinksFooter.vue'

const router = useRouter()
const appStore = useAppStore()
const capabilityStore = useCapabilityStore()
const sessionStore = useSessionStore()
const installFeedback = ref('')
const canPromptInstall = computed(() => appStore.installPromptAvailable && !appStore.installedMode)
const offlineStatusText = computed(() => {
  if (appStore.offlineReady) return appStore.offlineMode ? '100% Offline.' : 'Siap Offline.'
  if (appStore.serviceWorkerStatus === 'unsupported') return 'Offline terbatas.'
  if (appStore.serviceWorkerStatus === 'error') return 'Cache offline perlu dicek.'

  return 'Menyiapkan offline.'
})
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
    baseClass: 'relative z-20 w-[56%]',
  },
] as const

capabilityStore.detectCapabilities()

async function startFreshSession(source: 'camera' | 'upload') {
  void requestPersistentStorage()
  await abandonIncompleteSession(sessionStore.sessionId)
  sessionStore.reset()
  clearPendingSessionConfig()
  router.push({ path: '/config', query: { source } })
}

function startWithCamera() {
  void startFreshSession('camera')
}

function startWithUpload() {
  void startFreshSession('upload')
}

function startBoothBareng() {
  router.push('/booth')
}

async function installApp() {
  installFeedback.value = ''
  const outcome = await promptPwaInstall()

  if (outcome === 'accepted') {
    installFeedback.value = 'Stecute sedang dipasang ke perangkat.'
    return
  }

  if (outcome === 'dismissed') {
    installFeedback.value = 'Kamu bisa pasang Stecute nanti dari tombol ini.'
    return
  }

  installFeedback.value = 'Gunakan menu browser untuk menambahkan Stecute ke layar utama.'
}
</script>

<template>
  <div :class="ui.page">
    <nav :class="ui.headerWide">
      <div :class="ui.headerGroup">
        <img
          class="block h-auto w-[108px]"
          src="/icons.svg"
          alt="Stecute"
          width="442"
          height="123"
          decoding="async"
        />
      </div>
      <div class="flex items-center gap-2">
        <div class="hidden md:block">
          <button :class="ui.ghostButton" @click="startWithUpload">Upload Lokal</button>
        </div>
        <button
          :class="ui.iconButton"
          aria-label="Buka galeri"
          title="Galeri"
          @click="router.push('/gallery')"
        >
          <svg
            aria-hidden="true"
            width="16"
            height="16"
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

    <main
      class="mx-auto grid w-full max-w-5xl flex-1 content-start grid-cols-1 items-start gap-8 px-4 py-8 sm:px-5 sm:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.9fr)] lg:items-center lg:gap-10"
    >
      <section class="flex min-w-0 flex-col">
        <p :class="ui.sectionLabel">Photo booth lokal</p>
        <h1
          class="text-stc-text mt-2 max-w-[14ch] text-3xl leading-tight font-semibold tracking-tight sm:text-4xl"
        >
          Stecute Photo Booth
        </h1>

        <p class="text-stc-text-soft mt-3 max-w-[38em] text-[13px] leading-normal sm:text-sm">
          Buka kamera, ambil beberapa pose, lalu simpan photo strip langsung di perangkat.
          {{ offlineStatusText }}
        </p>

        <div class="mt-6 flex flex-wrap items-center gap-2">
          <button :class="ui.primaryButton" @click="startWithCamera">Mulai Foto</button>
          <button :class="ui.secondaryButton" @click="startBoothBareng">Foto Duet</button>
          <button v-if="canPromptInstall" :class="ui.ghostButton" @click="installApp">
            Pasang App
          </button>
          <div class="md:hidden">
            <button :class="ui.ghostButton" @click="startWithUpload">Upload Lokal</button>
          </div>
        </div>
        <p v-if="installFeedback" class="text-stc-text-soft mt-2 max-w-[32rem] text-[13px]">
          {{ installFeedback }}
        </p>

        <p class="text-stc-text-faint mt-4 text-[13px]">
          Tanpa Login · Privasi Terjaga · Hasil Lokal
        </p>
      </section>

      <section
        class="border-stc-border bg-stc-bg-2 relative mx-auto flex h-[22rem] w-full max-w-md flex-col overflow-hidden rounded-lg border sm:h-[26rem]"
        aria-label="Preview Stecute"
      >
        <div class="relative flex-1 overflow-hidden">
          <div
            class="absolute top-6 left-1/2 flex w-[240px] -translate-x-1/2 justify-center sm:top-8 sm:w-[280px]"
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
              :class="[image.baseClass, 'shadow-stc-sm rounded-md border border-white/80 bg-white']"
            />
          </div>
        </div>

        <div
          class="border-stc-border relative z-30 grid grid-cols-3 border-t bg-white px-4 py-3 text-center"
        >
          <div>
            <p :class="ui.sectionLabel">Layout</p>
            <p class="text-stc-text mt-0.5 text-[13px] font-medium">2/3/4/6</p>
          </div>
          <div class="border-stc-border border-x">
            <p :class="ui.sectionLabel">Timer</p>
            <p class="text-stc-text mt-0.5 text-[13px] font-medium">3-10s</p>
          </div>
          <div>
            <p :class="ui.sectionLabel">Penyimpanan</p>
            <p class="text-stc-text mt-0.5 text-[13px] font-medium">Lokal</p>
          </div>
        </div>
      </section>
    </main>

    <PublicLinksFooter />
  </div>
</template>
