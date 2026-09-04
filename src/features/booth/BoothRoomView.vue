<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Shot } from '@/db/schema'
import { strip2Config } from '@/layouts/strip-2/config'
import { classicTemplate } from '@/templates/classic/config'
import { useCameraStore } from '@/app/store/useCameraStore'
import { captureFrame, initCamera, shouldMirrorCamera, stopCamera } from '@/services/camera'
import { createDefaultDecorationConfig } from '@/services/session'
import { renderStrip } from '@/services/render'
import {
  boothChannelName,
  buildInviteUrl,
  createBoothPeerSession,
  createBroadcastBoothTransport,
  createPeerId,
  joinBoothByCode,
  joinBoothByInvite,
  normalizeBoothCode,
  type BoothIdentity,
  type BoothJoinError,
  type BoothPeerRole,
  type BoothPeerSession,
  type ComposedPairShot,
} from '@/services/booth'
import { ui } from '@/ui/styles'

const MOMENT_COUNT = 2
const ROLE_KEY = 'stecute.booth.role'
const PEER_KEY = 'stecute.booth.peer'

const route = useRoute()
const router = useRouter()
const cameraStore = useCameraStore()

const identity = ref<BoothIdentity | null>(null)
const joinError = ref<BoothJoinError | null>(null)
const role = ref<BoothPeerRole>('guest')
const inviteUrl = ref('')
const participantCount = ref(1)
const cameraError = ref('')
const statusMessage = ref('Menunggu teman gabung.')
const countdownValue = ref<number | null>(null)
const currentMoment = ref(0)
const composedShots = ref<ComposedPairShot[]>([])
const renderUrl = ref('')
const rendering = ref(false)
const videoRef = ref<HTMLVideoElement | null>(null)

let stream: MediaStream | null = null
let peerSession: BoothPeerSession | null = null
let countdownTimer: ReturnType<typeof setInterval> | null = null
let presenceTimer: ReturnType<typeof setInterval> | null = null
let captureLoop: Promise<void> | null = null

const formattedCode = computed(() => identity.value?.code ?? '')
const canStart = computed(
  () =>
    role.value === 'host' &&
    participantCount.value >= 2 &&
    countdownValue.value == null &&
    composedShots.value.length < MOMENT_COUNT &&
    !rendering.value,
)
const waitingLabel = computed(() => `${Math.min(participantCount.value, 2)}/2`)

function resolveRole(code: string): BoothPeerRole {
  const normalized = normalizeBoothCode(code)
  if (!normalized) return 'guest'
  const stored = sessionStorage.getItem(`${ROLE_KEY}.${normalized}`)
  if (stored === 'host') return 'host'
  if (route.query.role === 'host') return 'host'
  return 'guest'
}

function persistPeer(code: string, peerId: string, nextRole: BoothPeerRole) {
  const normalized = normalizeBoothCode(code)
  if (!normalized) return
  sessionStorage.setItem(`${ROLE_KEY}.${normalized}`, nextRole)
  sessionStorage.setItem(`${PEER_KEY}.${normalized}`, peerId)
}

function readPeerId(code: string): string {
  const normalized = normalizeBoothCode(code)
  const stored = normalized ? sessionStorage.getItem(`${PEER_KEY}.${normalized}`) : null
  return stored || createPeerId()
}

function errorCopy(reason: BoothJoinError) {
  if (reason === 'missing') return 'Masukkan kode booth.'
  if (reason === 'malformed') return 'Kode booth tidak valid.'
  return 'Booth tidak ditemukan.'
}

async function startCamera() {
  cameraError.value = ''
  try {
    stream = await initCamera()
    if (videoRef.value) videoRef.value.srcObject = stream
  } catch {
    cameraError.value = 'Kamera tidak tersedia. Preview opsional; kode booth tetap bisa dibagikan.'
  }
}

function stopPreview() {
  if (stream) {
    stopCamera(stream)
    stream = null
  }
  if (videoRef.value) videoRef.value.srcObject = null
}

function stopCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
  countdownValue.value = null
}

async function captureCurrentMoment(momentIndex: number) {
  if (!peerSession || !videoRef.value) return

  try {
    const still = await captureFrame(videoRef.value, {
      mirrored: shouldMirrorCamera(cameraStore.activeFacingMode),
    })
    await peerSession.submitStill(momentIndex, still)
    const shot = await peerSession.waitForComposed(momentIndex)
    const next = [...composedShots.value]
    next[momentIndex] = shot
    composedShots.value = next
    currentMoment.value = Math.min(MOMENT_COUNT, momentIndex + 1)
    if (next.filter(Boolean).length >= MOMENT_COUNT) {
      statusMessage.value = 'Strip siap dirender.'
    } else {
      statusMessage.value = `Pose ${momentIndex + 1} tersimpan. Siap pose berikutnya.`
    }
  } catch {
    statusMessage.value = 'Gagal mengambil still. Coba mulai pose lagi.'
  }
}

function runCountdown(momentIndex: number, countdownMs: number) {
  stopCountdown()
  const totalSeconds = Math.max(1, Math.round(countdownMs / 1000))
  countdownValue.value = totalSeconds
  statusMessage.value = `Pose ${momentIndex + 1} dari ${MOMENT_COUNT}`

  countdownTimer = setInterval(() => {
    if (countdownValue.value == null) return
    if (countdownValue.value <= 1) {
      stopCountdown()
      void captureCurrentMoment(momentIndex)
      return
    }
    countdownValue.value -= 1
  }, 1000)
}

function listenForRemoteCountdown(session: BoothPeerSession) {
  if (captureLoop) return
  captureLoop = (async () => {
    for (let momentIndex = currentMoment.value; momentIndex < MOMENT_COUNT; momentIndex++) {
      const countdownMs = await session.waitForCountdown(momentIndex)
      runCountdown(momentIndex, countdownMs)
    }
  })()
}

function startPose() {
  if (!peerSession || !canStart.value) return
  const momentIndex = composedShots.value.filter(Boolean).length
  peerSession.startMoment(momentIndex, 3000)
}

function disposeSession() {
  stopCountdown()
  if (presenceTimer) {
    clearInterval(presenceTimer)
    presenceTimer = null
  }
  peerSession?.dispose()
  peerSession = null
  captureLoop = null
}

async function renderBoothStrip() {
  if (composedShots.value.filter(Boolean).length < MOMENT_COUNT) return
  rendering.value = true
  statusMessage.value = 'Merender photo strip…'
  try {
    const shots: Shot[] = composedShots.value.map((shot, order) => ({
      id: `booth-${order}`,
      sessionId: identity.value?.boothId ?? 'booth',
      order,
      sourceType: 'camera',
      blob: shot.blob,
      width: shot.width,
      height: shot.height,
      createdAt: Date.now(),
    }))
    const result = await renderStrip({
      layout: strip2Config,
      template: classicTemplate,
      shots,
      decoration: createDefaultDecorationConfig(classicTemplate),
      format: 'image/png',
    })
    if (renderUrl.value) URL.revokeObjectURL(renderUrl.value)
    renderUrl.value = URL.createObjectURL(result.blob)
    statusMessage.value = 'Photo strip siap diunduh.'
  } catch {
    statusMessage.value = 'Render gagal. Coba lagi.'
  } finally {
    rendering.value = false
  }
}

function connectSession(next: BoothIdentity, nextRole: BoothPeerRole) {
  const normalized = normalizeBoothCode(next.code)
  if (!normalized) return

  const peerId = readPeerId(next.code)
  persistPeer(next.code, peerId, nextRole)

  if (typeof BroadcastChannel === 'undefined') {
    statusMessage.value =
      nextRole === 'host'
        ? 'Bagikan kode atau link. Signaling lokal belum tersedia.'
        : 'Masuk ke booth.'
    return
  }

  disposeSession()

  const transport = createBroadcastBoothTransport(boothChannelName(normalized))
  peerSession = createBoothPeerSession({
    peerId,
    role: nextRole,
    transport,
  })
  listenForRemoteCountdown(peerSession)

  presenceTimer = setInterval(() => {
    if (!peerSession) return
    if (peerSession.getRemotePeerId()) {
      participantCount.value = 2
      statusMessage.value =
        nextRole === 'host'
          ? 'Teman sudah masuk. Mulai pose kapan siap.'
          : 'Menunggu host memulai pose.'
    }
  }, 400)
}

function enterRoom() {
  joinError.value = null
  const param = String(route.params.code ?? '')
  const byCode = joinBoothByCode(param)
  const byInvite = joinBoothByInvite(route.path)
  const result = byCode.ok ? byCode : byInvite

  if (!result.ok) {
    joinError.value = result.reason
    identity.value = null
    return
  }

  identity.value = result.identity
  role.value = resolveRole(result.identity.code)
  inviteUrl.value = buildInviteUrl(window.location.origin, result.identity)
  participantCount.value = 1
  currentMoment.value = 0
  statusMessage.value = role.value === 'host' ? 'Menunggu teman gabung.' : 'Menghubungkan ke host…'
  connectSession(result.identity, role.value)
}

onMounted(() => {
  enterRoom()
  void startCamera()
})

watch(
  () => route.params.code,
  () => {
    composedShots.value = []
    enterRoom()
  },
)

onUnmounted(() => {
  disposeSession()
  stopPreview()
  if (renderUrl.value) URL.revokeObjectURL(renderUrl.value)
})
</script>

<template>
  <div :class="ui.page">
    <nav :class="ui.header">
      <div :class="ui.headerGroup">
        <button :class="ui.iconButton" aria-label="Kembali" @click="router.push('/booth')">
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
          <p :class="ui.sectionLabel">Booth Bareng</p>
          <h1 :class="ui.title">{{ joinError ? 'Booth tidak bisa dibuka' : 'Ruang booth' }}</h1>
        </div>
      </div>
    </nav>

    <main :class="[ui.content, 'flex-col gap-6 pb-12']">
      <section v-if="joinError" :class="[ui.emptyPanel, 'max-w-lg']">
        <p class="text-stc-text text-lg font-bold" role="alert">{{ errorCopy(joinError) }}</p>
        <p class="text-stc-text-soft mt-2 text-sm font-medium">
          Cek kode atau minta host membagikan link undangan yang baru.
        </p>
        <button class="mt-6" :class="ui.secondaryButton" @click="router.push('/booth')">
          Kembali ke Booth Bareng
        </button>
      </section>

      <template v-else>
        <section :class="[ui.panel, 'p-5 sm:p-6']">
          <p :class="ui.sectionLabel">Kode booth</p>
          <p
            class="text-stc-text mt-2 text-3xl font-bold tracking-[0.18em]"
            data-testid="booth-code"
            aria-label="Kode booth aktif"
          >
            {{ formattedCode }}
          </p>
          <p class="text-stc-text-soft mt-3 text-sm font-medium">
            {{ role === 'host' ? 'Host' : 'Tamu' }} · {{ waitingLabel }} orang · tanpa audio
          </p>
          <label
            class="text-stc-text-soft mt-5 block text-xs font-bold uppercase"
            for="booth-invite-url"
          >
            Link undangan
          </label>
          <input
            id="booth-invite-url"
            :value="inviteUrl"
            class="border-stc-border text-stc-text shadow-stc-xs mt-2 min-h-12 w-full rounded-xl border bg-white px-3 text-sm font-semibold"
            data-testid="booth-invite-url"
            aria-label="Link undangan"
            readonly
          />
        </section>

        <section :class="[ui.panel, 'overflow-hidden']">
          <div class="bg-black">
            <video
              ref="videoRef"
              class="mx-auto aspect-[4/3] w-full max-w-xl object-cover"
              autoplay
              muted
              playsinline
            />
          </div>
          <div class="p-5">
            <p class="text-stc-text text-sm font-semibold">{{ statusMessage }}</p>
            <p v-if="cameraError" class="text-stc-text-soft mt-2 text-xs font-medium">
              {{ cameraError }}
            </p>
            <p
              v-if="countdownValue != null"
              class="text-stc-pink mt-4 text-5xl font-bold"
              aria-live="assertive"
            >
              {{ countdownValue }}
            </p>
            <div class="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                v-if="role === 'host'"
                :class="ui.primaryButton"
                :disabled="!canStart"
                @click="startPose"
              >
                Mulai pose
              </button>
              <button
                v-if="composedShots.filter(Boolean).length >= MOMENT_COUNT"
                :class="ui.successButton"
                :disabled="rendering"
                @click="renderBoothStrip"
              >
                Render strip
              </button>
            </div>
          </div>
        </section>

        <section v-if="renderUrl" :class="[ui.panel, 'p-5']">
          <p :class="ui.sectionLabel">Hasil</p>
          <img :src="renderUrl" alt="Photo strip Booth Bareng" class="mx-auto mt-4 max-h-[32rem]" />
          <a
            class="mt-5 inline-flex"
            :class="ui.primaryButton"
            :href="renderUrl"
            download="stecute-booth.png"
          >
            Unduh PNG
          </a>
        </section>
      </template>
    </main>
  </div>
</template>
