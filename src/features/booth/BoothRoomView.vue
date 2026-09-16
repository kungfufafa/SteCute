<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { strip2Config } from '@/layouts/strip-2/config'
import { classicTemplate } from '@/templates/classic/config'
import { captureFrame, initCamera, stopCamera } from '@/services/camera'
import {
  createDefaultDecorationConfig,
  createSession,
  getRenderById,
  renderAndStoreSession,
  saveShot,
} from '@/services/session'
import {
  buildInviteUrl,
  createBoothPeerSession,
  createBoothRoomTransport,
  createPeerId,
  joinBoothByCode,
  joinBoothByInvite,
  normalizeBoothCode,
  type BoothIdentity,
  type BoothJoinError,
  type BoothPeerRole,
  type BoothPeerSession,
  type BoothTransport,
  type ComposedPairShot,
} from '@/services/booth'
import { ui } from '@/ui/styles'

const MOMENT_COUNT = 2
const ROLE_KEY = 'stecute.booth.role'
const PEER_KEY = 'stecute.booth.peer'
const CONNECTION_WAIT_MS = 20_000

const route = useRoute()
const router = useRouter()

const identity = ref<BoothIdentity | null>(null)
const joinError = ref<BoothJoinError | 'full' | null>(null)
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
const savedToGallery = ref(false)
const connectionHelp = ref(false)
const copyNotice = ref('')
const cameraLive = ref(false)
const videoRef = ref<HTMLVideoElement | null>(null)
const remoteVideoRef = ref<HTMLVideoElement | null>(null)
const remoteStream = ref<MediaStream | null>(null)
const remoteVideoReady = ref(false)

let stream: MediaStream | null = null
let peerSession: BoothPeerSession | null = null
let roomTransport: BoothTransport | null = null
let unsubRemoteStream: (() => void) | null = null
let countdownTimer: ReturnType<typeof setInterval> | null = null
let presenceTimer: ReturnType<typeof setInterval> | null = null
let captureLoop: Promise<void> | null = null
let countdownResolve: (() => void) | null = null
let waitStartedAt = Date.now()

const formattedCode = computed(() => identity.value?.code ?? '')
const canStart = computed(
  () =>
    role.value === 'host' &&
    participantCount.value >= 2 &&
    countdownValue.value == null &&
    composedShots.value.filter(Boolean).length < MOMENT_COUNT &&
    !rendering.value,
)
const waitingLabel = computed(() => `${Math.min(participantCount.value, 2)}/2`)
const capturedCount = computed(() => composedShots.value.filter(Boolean).length)
const friendJoined = computed(() => participantCount.value >= 2)
const cameraReady = computed(() => cameraLive.value && !cameraError.value)
const localTileLabel = computed(() => (role.value === 'host' ? 'Kamu · Host' : 'Kamu · Tamu'))
const remoteTileLabel = computed(() => (role.value === 'host' ? 'Teman · Tamu' : 'Teman · Host'))
const remoteWaitingCopy = computed(() =>
  friendJoined.value ? 'Menghubungkan video teman…' : 'Menunggu teman gabung',
)

let copyNoticeTimer: number | null = null

async function copyValue(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    copyNotice.value = `${label} disalin.`
  } catch {
    copyNotice.value = `Gagal menyalin. Salin ${label.toLowerCase()} secara manual.`
  }

  if (copyNoticeTimer) window.clearTimeout(copyNoticeTimer)
  copyNoticeTimer = window.setTimeout(() => {
    copyNotice.value = ''
    copyNoticeTimer = null
  }, 2000)
}

function resolveRole(code: string): BoothPeerRole {
  const normalized = normalizeBoothCode(code)
  if (!normalized) return 'guest'
  const stored = sessionStorage.getItem(`${ROLE_KEY}.${normalized}`)
  if (stored === 'host') return 'host'
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

function errorCopy(reason: BoothJoinError | 'full') {
  if (reason === 'missing') return 'Masukkan kode booth.'
  if (reason === 'malformed') return 'Kode booth tidak valid.'
  if (reason === 'full') return 'Booth sudah penuh. Maksimal 2 orang.'
  return 'Booth tidak ditemukan atau host belum online.'
}

watch(videoRef, () => {
  void attachPreviewStream()
})

watch([remoteVideoRef, remoteStream], () => {
  void attachRemoteStream()
})

async function attachPreviewStream() {
  if (!videoRef.value || !stream) return
  if (videoRef.value.srcObject !== stream) videoRef.value.srcObject = stream
  try {
    await videoRef.value.play()
  } catch {
    // Autoplay can be blocked; the user can still start a pose after interaction.
  }
}

function refreshRemoteVideoReady() {
  const el = remoteVideoRef.value
  remoteVideoReady.value = Boolean(el?.srcObject && el.videoWidth >= 48 && el.videoHeight >= 48)
}

async function attachRemoteStream() {
  const el = remoteVideoRef.value
  if (!el) return

  const next = remoteStream.value
  if (!next) {
    el.srcObject = null
    remoteVideoReady.value = false
    return
  }

  if (el.srcObject !== next) el.srcObject = next
  try {
    await el.play()
  } catch {
    // Autoplay can be blocked until the user interacts with the page.
  }
  refreshRemoteVideoReady()
}

function bindRoomMedia(transport: BoothTransport) {
  unsubRemoteStream?.()
  roomTransport = transport
  unsubRemoteStream =
    transport.media?.subscribeRemoteStream((next) => {
      remoteStream.value = next
    }) ?? null
  if (stream) transport.media?.attachLocalStream(stream)
}

async function startCamera() {
  cameraError.value = ''
  cameraLive.value = false
  try {
    stream = await initCamera()
    cameraLive.value = true
    roomTransport?.media?.attachLocalStream(stream)
    await nextTick()
    await attachPreviewStream()
  } catch {
    cameraLive.value = false
    cameraError.value = 'Kamera tidak tersedia. Preview opsional; kode booth tetap bisa dibagikan.'
  }
}

function stopPreview() {
  if (stream) {
    stopCamera(stream)
    stream = null
  }
  cameraLive.value = false
  if (videoRef.value) videoRef.value.srcObject = null
}

function finishCountdownWaiter() {
  const resolve = countdownResolve
  countdownResolve = null
  resolve?.()
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
    const still = await captureFrame(videoRef.value, { mirrored: false })
    await peerSession.submitStill(momentIndex, still)
    const shot = await peerSession.waitForComposed(momentIndex, 30_000)
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

function runCountdown(momentIndex: number, countdownMs: number): Promise<void> {
  stopCountdown()
  finishCountdownWaiter()
  const totalSeconds = Math.max(1, Math.round(countdownMs / 1000))
  countdownValue.value = totalSeconds
  statusMessage.value = `Pose ${momentIndex + 1} dari ${MOMENT_COUNT}`

  return new Promise((resolve) => {
    countdownResolve = resolve
    countdownTimer = setInterval(() => {
      if (countdownValue.value == null) {
        finishCountdownWaiter()
        return
      }
      if (countdownValue.value <= 1) {
        stopCountdown()
        void captureCurrentMoment(momentIndex).finally(finishCountdownWaiter)
        return
      }
      countdownValue.value -= 1
    }, 1000)
  })
}

function listenForRemoteCountdown(session: BoothPeerSession) {
  if (captureLoop) return
  captureLoop = (async () => {
    try {
      while (session === peerSession) {
        const start = await session.waitForStart()
        await runCountdown(start.momentIndex, start.countdownMs)
      }
    } catch {
      // Session disposed or host left; presence copy handles the UI.
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
  finishCountdownWaiter()
  if (presenceTimer) {
    clearInterval(presenceTimer)
    presenceTimer = null
  }
  unsubRemoteStream?.()
  unsubRemoteStream = null
  roomTransport = null
  remoteStream.value = null
  remoteVideoReady.value = false
  peerSession?.dispose()
  peerSession = null
  captureLoop = null
}

async function renderBoothStrip() {
  if (composedShots.value.filter(Boolean).length < MOMENT_COUNT) return
  rendering.value = true
  savedToGallery.value = false
  statusMessage.value = 'Merender photo strip…'
  try {
    const decoration = createDefaultDecorationConfig(classicTemplate)
    const sessionId = await createSession({
      layoutId: strip2Config.id,
      templateId: classicTemplate.id,
      slotCount: strip2Config.slotCount,
      captureSource: 'camera',
      decoration,
    })

    for (const [order, shot] of composedShots.value.entries()) {
      if (!shot) continue
      await saveShot({
        sessionId,
        order,
        sourceType: 'camera',
        blob: shot.blob,
        width: shot.width,
        height: shot.height,
      })
    }

    const renderId = await renderAndStoreSession({
      sessionId,
      layout: strip2Config,
      template: classicTemplate,
      decoration,
      format: 'image/png',
    })
    const stored = await getRenderById(renderId)
    const blob = stored?.blob
    if (!blob) throw new Error('Booth render missing')

    if (renderUrl.value) URL.revokeObjectURL(renderUrl.value)
    renderUrl.value = URL.createObjectURL(blob)
    savedToGallery.value = true
    statusMessage.value = 'Photo strip siap diunduh dan tersimpan di galeri.'
  } catch {
    statusMessage.value = 'Render gagal. Coba lagi.'
  } finally {
    rendering.value = false
  }
}

function updatePresenceStatus(nextRole: BoothPeerRole) {
  if (!peerSession || joinError.value) return

  if (peerSession.getRejectedReason() === 'full') {
    joinError.value = 'full'
    statusMessage.value = 'Booth sudah penuh.'
    disposeSession()
    return
  }

  if (peerSession.getRemotePeerId()) {
    participantCount.value = 2
  } else {
    participantCount.value = 1
  }

  if (rendering.value || renderUrl.value) return
  if (countdownValue.value != null) return

  const capturedCount = composedShots.value.filter(Boolean).length
  if (capturedCount >= MOMENT_COUNT) {
    statusMessage.value = 'Strip siap dirender.'
    return
  }
  if (capturedCount > 0 && participantCount.value >= 2) {
    statusMessage.value = `Pose ${capturedCount} tersimpan. Siap pose berikutnya.`
    return
  }

  if (participantCount.value >= 2) {
    connectionHelp.value = false
    waitStartedAt = Date.now()
    statusMessage.value =
      nextRole === 'host'
        ? 'Teman sudah masuk. Mulai pose kapan siap.'
        : 'Menunggu host memulai pose.'
    return
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    connectionHelp.value = true
    statusMessage.value = 'Booth Bareng butuh internet. Cek koneksi, lalu coba hubungkan lagi.'
    return
  }

  if (Date.now() - waitStartedAt >= CONNECTION_WAIT_MS) {
    connectionHelp.value = true
    statusMessage.value =
      nextRole === 'guest'
        ? 'Belum terhubung ke host. Pastikan host masih membuka ruang booth, lalu coba hubungkan lagi.'
        : 'Teman belum masuk. Pastikan mereka membuka link atau kode yang sama, lalu tetap di halaman ini.'
    return
  }

  connectionHelp.value = false
  statusMessage.value =
    nextRole === 'host' ? 'Menunggu teman gabung.' : 'Host belum online. Tetap mencoba…'
}

async function connectSession(next: BoothIdentity, nextRole: BoothPeerRole) {
  const normalized = normalizeBoothCode(next.code)
  if (!normalized) return

  const peerId = readPeerId(next.code)
  persistPeer(next.code, peerId, nextRole)
  disposeSession()
  waitStartedAt = Date.now()
  connectionHelp.value = false

  try {
    const transport = await createBoothRoomTransport(normalized, nextRole)
    bindRoomMedia(transport)
    peerSession = createBoothPeerSession({
      peerId,
      role: nextRole,
      transport,
    })
    listenForRemoteCountdown(peerSession)
  } catch {
    joinError.value = nextRole === 'guest' ? 'unknown' : joinError.value
    statusMessage.value = 'Signaling booth gagal. Coba buat booth baru.'
    return
  }

  presenceTimer = setInterval(() => {
    if (!peerSession) return
    peerSession.announce()
    updatePresenceStatus(nextRole)
  }, 400)

  if (nextRole === 'guest') {
    statusMessage.value = 'Menghubungkan ke host…'
  }
}

function retryConnection() {
  if (!identity.value) return
  connectSession(identity.value, role.value)
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
  if (copyNoticeTimer) window.clearTimeout(copyNoticeTimer)
  if (renderUrl.value) URL.revokeObjectURL(renderUrl.value)
})
</script>

<template>
  <div :class="ui.page">
    <div :class="ui.header">
      <div :class="ui.headerGroup">
        <button
          :class="ui.iconButton"
          aria-label="Kembali ke Booth Bareng"
          @click="router.push('/booth')"
        >
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
          <h1 :class="ui.title">{{ joinError ? 'Booth tidak bisa dibuka' : 'Ruang booth' }}</h1>
          <p :class="ui.subtitle">Booth Bareng · video berdua, tanpa audio dan tanpa mirror.</p>
        </div>
      </div>
      <span v-if="!joinError" :class="ui.badge">{{ role === 'host' ? 'Host' : 'Tamu' }}</span>
    </div>

    <main :class="[ui.content, 'gap-6']">
      <section v-if="joinError" :class="[ui.emptyPanel, 'max-w-lg']">
        <p class="text-stc-text text-lg font-semibold" role="alert">{{ errorCopy(joinError) }}</p>
        <p class="text-stc-text-soft mt-2 text-sm leading-normal">
          Cek kode atau minta host membagikan link undangan yang baru.
        </p>
        <button
          class="mt-6"
          :class="[ui.secondaryButton, 'sm:w-auto sm:self-center']"
          @click="router.push('/booth')"
        >
          Kembali ke Booth Bareng
        </button>
      </section>

      <template v-else>
        <div
          class="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start"
        >
          <section class="min-w-0 space-y-4">
            <div
              class="border-stc-border relative overflow-hidden rounded-lg border bg-black"
              data-testid="booth-stage"
            >
              <div class="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-white">
                <span
                  :class="[
                    'inline-flex size-2 shrink-0 rounded-full',
                    friendJoined ? 'bg-stc-success' : 'bg-stc-pink',
                  ]"
                />
                <span class="min-w-0 truncate">{{ statusMessage }}</span>
              </div>

              <div class="grid grid-cols-1 gap-1 p-1 sm:grid-cols-2">
                <article
                  class="relative aspect-[4/3] min-w-0 overflow-hidden rounded-md bg-zinc-950"
                  :class="role === 'host' ? 'order-1' : 'order-2'"
                  data-testid="booth-local-tile"
                >
                  <video
                    ref="videoRef"
                    class="absolute inset-0 h-full w-full object-cover"
                    data-testid="booth-local-video"
                    autoplay
                    muted
                    playsinline
                  />
                  <div
                    v-if="!cameraReady"
                    class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-zinc-950 px-3 text-center"
                  >
                    <p class="text-xs font-semibold text-white">Kameramu</p>
                    <p class="max-w-[16rem] text-[11px] leading-normal text-white/70">
                      {{ cameraError || 'Izinkan kamera. Kode booth tetap bisa dibagikan.' }}
                    </p>
                  </div>
                  <div
                    class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2.5 pt-8 pb-2"
                  >
                    <div class="flex items-center justify-between gap-2">
                      <p class="truncate text-xs font-semibold text-white">{{ localTileLabel }}</p>
                      <span
                        v-if="cameraReady"
                        class="inline-flex items-center gap-1 rounded-full bg-black/45 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase"
                      >
                        <span class="bg-stc-success inline-flex size-1.5 rounded-full" />
                        Live
                      </span>
                    </div>
                  </div>
                </article>

                <article
                  class="relative aspect-[4/3] min-w-0 overflow-hidden rounded-md bg-zinc-950"
                  :class="role === 'host' ? 'order-2' : 'order-1'"
                  data-testid="booth-remote-tile"
                >
                  <video
                    ref="remoteVideoRef"
                    class="absolute inset-0 h-full w-full object-cover"
                    data-testid="booth-remote-video"
                    autoplay
                    muted
                    playsinline
                    @loadedmetadata="refreshRemoteVideoReady"
                    @resize="refreshRemoteVideoReady"
                    @playing="refreshRemoteVideoReady"
                  />
                  <div
                    v-if="!remoteVideoReady"
                    class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-zinc-950 px-3 text-center"
                  >
                    <span
                      class="flex size-10 items-center justify-center rounded-xl bg-white/10 text-white"
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </span>
                    <p class="text-xs font-semibold text-white">{{ remoteWaitingCopy }}</p>
                    <p class="max-w-[16rem] text-[11px] leading-normal text-white/70">
                      Seperti video call, tanpa suara.
                    </p>
                  </div>
                  <div
                    class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2.5 pt-8 pb-2"
                  >
                    <div class="flex items-center justify-between gap-2">
                      <p class="truncate text-xs font-semibold text-white">{{ remoteTileLabel }}</p>
                      <span
                        v-if="remoteVideoReady"
                        class="inline-flex items-center gap-1 rounded-full bg-black/45 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase"
                      >
                        <span class="bg-stc-success inline-flex size-1.5 rounded-full" />
                        Live
                      </span>
                    </div>
                  </div>
                </article>
              </div>

              <p
                v-if="countdownValue != null"
                class="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/35 text-6xl font-semibold text-white"
                aria-live="assertive"
              >
                {{ countdownValue }}
              </p>
            </div>

            <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                v-if="role === 'host'"
                :class="[ui.primaryButton, 'sm:!w-auto sm:min-w-48']"
                :disabled="!canStart"
                @click="startPose"
              >
                Mulai pose
              </button>
              <button
                v-if="connectionHelp && capturedCount < MOMENT_COUNT"
                :class="[ui.secondaryButton, 'sm:!w-auto sm:min-w-48']"
                @click="retryConnection"
              >
                Coba Hubungkan Lagi
              </button>
              <button
                v-if="capturedCount >= MOMENT_COUNT"
                :class="[ui.successButton, 'sm:!w-auto sm:min-w-48']"
                :disabled="rendering"
                @click="renderBoothStrip"
              >
                {{ rendering ? 'Merender...' : 'Render strip' }}
              </button>
            </div>
          </section>

          <aside class="lg:sticky lg:top-6" aria-label="Kode dan status booth">
            <div :class="[ui.panel, 'space-y-4 p-4']">
              <div>
                <p :class="ui.sectionLabel">Kode booth</p>
                <p
                  class="text-stc-text mt-2 text-3xl font-semibold tracking-[0.18em]"
                  data-testid="booth-code"
                  aria-label="Kode booth aktif"
                >
                  {{ formattedCode }}
                </p>
                <button
                  type="button"
                  :class="[ui.secondaryButton, 'mt-3']"
                  @click="copyValue(formattedCode, 'Kode')"
                >
                  Salin kode
                </button>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <div :class="ui.softTile">
                  <p :class="ui.sectionLabel">Kamu</p>
                  <p class="text-stc-text mt-1 text-sm font-semibold">
                    {{ role === 'host' ? 'Host' : 'Tamu' }}
                  </p>
                </div>
                <div :class="ui.softTile">
                  <p :class="ui.sectionLabel">Teman</p>
                  <p class="text-stc-text mt-1 text-sm font-semibold">
                    {{ friendJoined ? 'Sudah masuk' : 'Menunggu' }}
                  </p>
                </div>
              </div>

              <div>
                <p :class="ui.sectionLabel">Pose</p>
                <div class="mt-3 flex gap-2">
                  <span
                    v-for="index in MOMENT_COUNT"
                    :key="index"
                    class="inline-flex size-8 items-center justify-center rounded-md text-[13px] font-medium"
                    :class="
                      composedShots[index - 1]
                        ? 'bg-stc-pink text-white'
                        : currentMoment === index - 1 && countdownValue != null
                          ? 'bg-stc-pink-soft text-stc-pink-strong'
                          : 'bg-stc-bg-2 text-stc-text'
                    "
                  >
                    {{ index }}
                  </span>
                </div>
                <p class="text-stc-text-soft mt-2 text-xs">
                  {{ waitingLabel }} orang · {{ capturedCount }}/{{ MOMENT_COUNT }} pose
                </p>
              </div>

              <div>
                <label
                  class="text-stc-text-faint block text-xs font-semibold tracking-wide uppercase"
                  for="booth-invite-url"
                >
                  Link undangan
                </label>
                <input
                  id="booth-invite-url"
                  :value="inviteUrl"
                  :class="[ui.input, 'mt-2']"
                  data-testid="booth-invite-url"
                  aria-label="Link undangan"
                  readonly
                />
                <button
                  type="button"
                  :class="[ui.secondaryButton, 'mt-2']"
                  @click="copyValue(inviteUrl, 'Link')"
                >
                  Salin tautan
                </button>
                <p v-if="copyNotice" class="text-stc-text-soft mt-2 text-xs">{{ copyNotice }}</p>
              </div>
            </div>
          </aside>
        </div>

        <section v-if="renderUrl" :class="[ui.panel, 'p-4']">
          <p :class="ui.sectionLabel">Hasil</p>
          <p class="text-stc-text-soft mt-2 text-sm leading-normal">
            {{
              savedToGallery
                ? 'Hasil sudah tersimpan di galeri lokal perangkat ini.'
                : 'Hasil siap diunduh.'
            }}
          </p>
          <img :src="renderUrl" alt="Photo strip Booth Bareng" class="mx-auto mt-4 max-h-[32rem]" />
          <div class="mt-5 flex flex-col gap-3 sm:flex-row">
            <a
              class="inline-flex"
              :class="[ui.primaryButton, 'sm:w-auto']"
              :href="renderUrl"
              download="stecute-booth.png"
            >
              Unduh PNG
            </a>
            <button
              v-if="savedToGallery"
              :class="[ui.secondaryButton, 'sm:w-auto']"
              @click="router.push('/gallery')"
            >
              Buka Galeri
            </button>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>
