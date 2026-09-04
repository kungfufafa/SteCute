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
    <nav :class="ui.header">
      <div :class="ui.headerGroup">
        <button :class="ui.iconButton" aria-label="Kembali" @click="router.push('/')">
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
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div>
          <p :class="ui.sectionLabel">Mode online opsional</p>
          <h1 :class="ui.title">Booth Bareng</h1>
        </div>
      </div>
    </nav>

    <main :class="[ui.content, 'flex-col gap-6 pb-12']">
      <p :class="ui.sectionCopy">
        Photobooth untuk dua orang. Masuk pakai link undangan atau kode unik, tanpa akun dan tanpa
        audio. Alur <strong>Mulai Foto</strong> dan <strong>Upload Lokal</strong> tetap jalan tanpa
        mode ini.
      </p>

      <section :class="[ui.panel, 'p-5 sm:p-6']">
        <h2 class="text-stc-text text-lg font-bold">Buat booth</h2>
        <p class="text-stc-text-soft mt-2 text-sm font-medium">
          Kamu jadi host. Teman gabung lewat kode atau link yang sama.
        </p>
        <button class="mt-5" :class="ui.primaryButton" @click="createRoom">Buat Booth</button>
        <p v-if="createError" class="text-stc-error mt-3 text-sm font-semibold">
          {{ createError }}
        </p>
      </section>

      <section :class="[ui.panel, 'p-5 sm:p-6']">
        <h2 class="text-stc-text text-lg font-bold">Gabung dengan kode</h2>
        <form class="mt-4 flex flex-col gap-3" @submit.prevent="joinRoom">
          <label class="sr-only" for="booth-join-code">Kode booth</label>
          <input
            id="booth-join-code"
            v-model="joinCode"
            :class="[
              'border-stc-border text-stc-text shadow-stc-xs focus-visible:ring-stc-pink min-h-12 w-full rounded-xl border bg-white px-4 text-center text-lg font-bold tracking-[0.2em] uppercase outline-none focus-visible:ring-2',
            ]"
            name="booth-code"
            aria-label="Kode booth"
            autocomplete="off"
            spellcheck="false"
            placeholder="ABC-DEF"
          />
          <button :class="ui.secondaryButton" type="submit">Gabung</button>
        </form>
        <p v-if="joinError" class="text-stc-error mt-3 text-sm font-semibold" role="alert">
          {{ joinError }}
        </p>
      </section>
    </main>
  </div>
</template>
