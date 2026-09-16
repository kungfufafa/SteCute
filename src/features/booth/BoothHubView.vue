<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  createBooth,
  getBoothRegistry,
  joinBoothByCode,
  normalizeBoothCode,
} from '@/services/booth'
import { initCamera, stopCamera } from '@/services/camera'
import { ui } from '@/ui/styles'

const router = useRouter()
const joinCode = ref('')
const joinError = ref('')
const createError = ref('')
const cameraLive = ref(false)
const videoRef = ref<HTMLVideoElement | null>(null)
let stream: MediaStream | null = null

const ROLE_KEY = 'stecute.booth.role'
const PEER_KEY = 'stecute.booth.peer'

function persistHostRole(code: string) {
  const normalized = normalizeBoothCode(code)
  if (!normalized) return
  sessionStorage.setItem(`${ROLE_KEY}.${normalized}`, 'host')
}

function createRoom() {
  createError.value = ''
  try {
    const identity = createBooth(getBoothRegistry())
    persistHostRole(identity.code)
    router.push({ name: 'booth-join', params: { code: identity.code } })
  } catch {
    createError.value = 'Booth gagal dibuat. Coba lagi.'
  }
}

function joinRoom() {
  joinError.value = ''
  const result = joinBoothByCode(joinCode.value, getBoothRegistry())

  if (!result.ok) {
    if (result.reason === 'missing') {
      joinError.value = 'Masukkan kode booth.'
      return
    }
    if (result.reason === 'malformed') {
      joinError.value = 'Kode booth tidak valid.'
      return
    }
    joinError.value = 'Booth tidak ditemukan.'
    return
  }

  sessionStorage.removeItem(`${ROLE_KEY}.${normalizeBoothCode(result.identity.code)}`)
  sessionStorage.removeItem(`${PEER_KEY}.${normalizeBoothCode(result.identity.code)}`)
  router.push({ name: 'booth-join', params: { code: result.identity.code } })
}

async function attachPreview() {
  if (!videoRef.value || !stream) return
  if (videoRef.value.srcObject !== stream) videoRef.value.srcObject = stream
  try {
    await videoRef.value.play()
  } catch {
    // Autoplay can wait for a tap on Buat Booth / Gabung.
  }
}

async function startPreview() {
  try {
    stream = await initCamera()
    cameraLive.value = true
    await nextTick()
    await attachPreview()
  } catch {
    cameraLive.value = false
  }
}

watch(videoRef, () => {
  void attachPreview()
})

onMounted(() => {
  void startPreview()
})

onUnmounted(() => {
  if (stream) {
    stopCamera(stream)
    stream = null
  }
  cameraLive.value = false
  if (videoRef.value) videoRef.value.srcObject = null
})
</script>

<template>
  <div :class="ui.page">
    <nav :class="ui.headerWide">
      <div :class="ui.headerGroup">
        <button :class="ui.iconButton" aria-label="Kembali ke beranda" @click="router.push('/')">
          <svg
            width="16"
            height="16"
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
        <img
          class="block h-auto w-[108px]"
          src="/icons.svg"
          alt="Stecute"
          width="442"
          height="123"
          decoding="async"
        />
      </div>
    </nav>

    <main
      class="mx-auto grid w-full max-w-5xl flex-1 content-start grid-cols-1 items-start gap-8 px-4 py-8 sm:px-5 sm:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.85fr)] lg:items-center lg:gap-12"
    >
      <section class="flex min-w-0 flex-col">
        <p :class="ui.sectionLabel">Photo booth berdua</p>
        <h1
          class="text-stc-text mt-2 max-w-[12ch] text-3xl leading-tight font-semibold tracking-tight sm:text-4xl"
        >
          Booth Bareng
        </h1>
        <p class="text-stc-text-soft mt-3 max-w-[36em] text-[13px] leading-normal sm:text-sm">
          Bagikan kode, lihat teman live, lalu simpan strip di perangkat. Tanpa akun dan tanpa
          audio.
        </p>

        <div class="mt-6 flex flex-wrap items-center gap-2">
          <button :class="ui.primaryButton" @click="createRoom">Buat Booth</button>
        </div>
        <p v-if="createError" class="text-stc-error-strong mt-2 text-[13px]">{{ createError }}</p>

        <form class="mt-8 max-w-sm" @submit.prevent="joinRoom">
          <label class="text-stc-text text-[13px] font-medium" for="booth-join-code">
            Kode booth
          </label>
          <div class="mt-2 flex gap-2">
            <input
              id="booth-join-code"
              v-model="joinCode"
              :class="[ui.input, 'h-10 flex-1 text-center tracking-[0.18em] uppercase']"
              name="booth-code"
              aria-label="Kode booth"
              autocomplete="off"
              spellcheck="false"
              placeholder="ABC-DEF"
              maxlength="7"
            />
            <button :class="ui.secondaryButton" type="submit">Gabung</button>
          </div>
          <p v-if="joinError" class="text-stc-error-strong mt-2 text-[13px]" role="alert">
            {{ joinError }}
          </p>
        </form>

        <p class="text-stc-text-faint mt-8 max-w-[40em] text-[13px] leading-normal">
          Review, lalu unduh PNG. Bisa review per-shot. Perangkat bisa beda jaringan. Mulai Foto dan
          Upload Lokal tetap jalan tanpa mode ini.
        </p>
      </section>

      <section
        class="border-stc-border mx-auto w-full max-w-md overflow-hidden rounded-lg border bg-black"
        aria-label="Preview kamera Booth Bareng"
      >
        <div class="grid aspect-[4/3] grid-cols-2">
          <article class="relative min-h-0 min-w-0 overflow-hidden bg-zinc-950">
            <video
              ref="videoRef"
              class="absolute inset-0 h-full w-full object-cover"
              autoplay
              muted
              playsinline
            />
            <div
              v-if="!cameraLive"
              class="absolute inset-0 flex items-center justify-center bg-zinc-950 px-3 text-center"
            >
              <p class="text-[11px] leading-normal text-white/70">Izinkan kamera untuk preview live.</p>
            </div>
            <p class="absolute bottom-2 left-2 text-xs font-semibold text-white drop-shadow">Kamu</p>
          </article>
          <article class="relative min-h-0 min-w-0 overflow-hidden bg-zinc-950">
            <p class="absolute bottom-2 left-2 text-xs font-semibold text-white drop-shadow">Teman</p>
          </article>
        </div>
      </section>
    </main>
  </div>
</template>
