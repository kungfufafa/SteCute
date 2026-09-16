<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  createBooth,
  getBoothRegistry,
  joinBoothByCode,
  normalizeBoothCode,
} from '@/services/booth'
import { ui } from '@/ui/styles'

const router = useRouter()
const joinCode = ref('')
const joinError = ref('')
const createError = ref('')

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
</script>

<template>
  <div :class="ui.page">
    <div :class="ui.header">
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
        <div class="min-w-0">
          <h1 :class="ui.title">Booth Bareng</h1>
          <p :class="ui.subtitle">
            Foto berdua lewat kode. Lihat teman secara live, tanpa akun dan tanpa audio.
          </p>
        </div>
      </div>
      <span :class="ui.badge">Opsional</span>
    </div>

    <main :class="[ui.content, 'gap-6']">
      <section class="grid gap-3 lg:grid-cols-2 lg:items-stretch">
        <article :class="[ui.panel, 'flex flex-col p-4']">
          <h2 class="text-stc-text text-[15px] font-medium">Buat booth</h2>
          <p class="text-stc-text-soft mt-1 flex-1 text-[13px] leading-normal">
            Kamu jadi host. Dapat kode dan link, lalu mulai pose setelah teman masuk.
          </p>
          <button :class="[ui.primaryButton, 'mt-4 self-start']" @click="createRoom">
            Buat Booth
          </button>
          <p v-if="createError" class="text-stc-error-strong mt-2 text-[13px]">
            {{ createError }}
          </p>
        </article>

        <article :class="[ui.panel, 'flex flex-col p-4']">
          <h2 class="text-stc-text text-[15px] font-medium">Gabung dengan kode</h2>
          <p class="text-stc-text-soft mt-1 text-[13px] leading-normal">
            Masukkan 6 karakter dari host, atau buka link undangan di HP lain.
          </p>
          <form class="mt-4 flex flex-1 flex-col gap-2" @submit.prevent="joinRoom">
            <label class="sr-only" for="booth-join-code">Kode booth</label>
            <input
              id="booth-join-code"
              v-model="joinCode"
              :class="[ui.input, 'h-10 text-center text-base tracking-[0.18em] uppercase']"
              name="booth-code"
              aria-label="Kode booth"
              autocomplete="off"
              spellcheck="false"
              placeholder="ABC-DEF"
              maxlength="7"
            />
            <button :class="ui.secondaryButton" type="submit">Gabung</button>
          </form>
          <p v-if="joinError" class="text-stc-error-strong mt-2 text-[13px]" role="alert">
            {{ joinError }}
          </p>
        </article>
      </section>

      <section class="border-stc-border divide-stc-border divide-y border-y">
        <div class="flex gap-3 py-3">
          <span class="text-stc-text-faint w-4 text-[13px]">1</span>
          <div>
            <p class="text-stc-text text-[13px] font-medium">Buat atau gabung</p>
            <p class="text-stc-text-soft mt-0.5 text-[13px] leading-normal">
              Host bagikan kode. Tamu masuk dari HP atau laptop lain.
            </p>
          </div>
        </div>
        <div class="flex gap-3 py-3">
          <span class="text-stc-text-faint w-4 text-[13px]">2</span>
          <div>
            <p class="text-stc-text text-[13px] font-medium">Lihat teman di layar</p>
            <p class="text-stc-text-soft mt-0.5 text-[13px] leading-normal">
              Layar jadi dua kotak seperti video call. Host kiri, tamu kanan, kamera tidak
              di-mirror. Kalau sudah berdua, host mulai pose.
            </p>
          </div>
        </div>
        <div class="flex gap-3 py-3">
          <span class="text-stc-text-faint w-4 text-[13px]">3</span>
          <div>
            <p class="text-stc-text text-[13px] font-medium">Strip jadi satu</p>
            <p class="text-stc-text-soft mt-0.5 text-[13px] leading-normal">
              Tiap pose menggabungkan foto host dan tamu ke satu baris.
            </p>
          </div>
        </div>
      </section>

      <p class="text-stc-text-faint max-w-[42em] text-[13px] leading-normal">
        Foto tidak disimpan di server. Perangkat bisa beda jaringan, termasuk 4G dan Wi-Fi kantor.
        Alur Mulai Foto dan Upload Lokal tetap jalan tanpa mode ini.
      </p>
    </main>
  </div>
</template>
