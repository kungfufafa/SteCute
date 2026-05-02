<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getSessionShots, resetSessionData, saveShot } from '@/services/session'
import { getImageDimensions, openImagePicker, validateFile } from '@/services/upload'
import { getTemplateById } from '@/templates'
import { useSessionStore } from '@/stores'
import { ui } from '@/ui/styles'
import { getLayoutById } from '@/layouts'

const router = useRouter()
const sessionStore = useSessionStore()
const activeLayout = computed(() => getLayoutById(sessionStore.layoutId))

const templateName = computed(() => getTemplateById(sessionStore.templateId)?.name ?? 'Classic')
const footerText = computed(() =>
  new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date()),
)

const shotUrls = ref<string[]>([])
const reviewError = ref<string | null>(null)

function revokeShotUrls() {
  shotUrls.value.forEach((url) => URL.revokeObjectURL(url))
  shotUrls.value = []
}

async function loadShotUrls() {
  const sessionId = sessionStore.sessionId
  if (!sessionId) return

  const shots = await getSessionShots(sessionId)
  revokeShotUrls()
  shotUrls.value = shots.map((shot) => URL.createObjectURL(shot.blob))
}

onMounted(async () => {
  await loadShotUrls()
})

onBeforeUnmount(() => {
  revokeShotUrls()
})

async function retakeAll() {
  if (sessionStore.sessionId) {
    await resetSessionData(sessionStore.sessionId)
  }
  sessionStore.reset()
  router.push('/config')
}

async function retakeShot(index: number) {
  reviewError.value = null

  if (sessionStore.captureSource === 'upload') {
    const files = await openImagePicker(false)
    const file = files?.[0]
    const sessionId = sessionStore.sessionId

    if (!file || !sessionId) return

    const validation = validateFile(file)

    if (!validation.valid) {
      reviewError.value = validation.errors[0] ?? 'File tidak valid.'
      return
    }

    const dimensions = await getImageDimensions(file)
    const blob = new Blob([await file.arrayBuffer()], { type: file.type })

    await saveShot({
      sessionId,
      order: index,
      sourceType: 'upload',
      blob,
      width: dimensions.width,
      height: dimensions.height,
    })

    await loadShotUrls()
    return
  }

  sessionStore.currentShotIndex = index
  router.push('/camera')
}

function proceedToCustomize() {
  router.push('/customize')
}

function saveDirectly() {
  router.push('/render')
}
</script>

<template>
  <div :class="ui.page">
    <div :class="ui.header">
      <div class="space-y-1">
        <h3 :class="ui.title">Preview</h3>
        <p :class="ui.subtitle">Ketuk foto untuk retake per-shot sebelum render final.</p>
      </div>
      <span :class="ui.pinkBadge">
        {{ activeLayout?.printFormat.paperSize ?? `${sessionStore.slotCount} Foto` }}
      </span>
    </div>

    <div :class="[ui.content, 'flex items-center justify-center']">
      <div :class="[ui.contentWrap, 'items-center gap-6 text-center']">
        <div
          class="w-full max-w-[19rem] overflow-hidden rounded-[28px] border border-stc-border bg-white shadow-[0_24px_60px_rgba(26,26,46,0.12)]"
        >
          <div class="flex items-center justify-between border-b border-stc-border bg-white px-4 py-3">
            <span class="text-xs font-semibold text-stc-text-faint">{{ templateName }} Template</span>
            <span class="text-xs font-bold text-stc-pink">
              {{ activeLayout?.printFormat.label ?? `${sessionStore.slotCount} Foto` }}
            </span>
          </div>

          <div
            :class="[
              'grid grid-cols-1 gap-1.5 bg-stc-bg-2 p-2',
            ]"
          >
            <button
              v-for="index in sessionStore.slotCount"
              :key="index"
              :class="[
                'group relative flex items-end overflow-hidden rounded-xl border border-white/70 bg-stc-bg-3 p-3 text-left shadow-inner transition-all duration-200 hover:-translate-y-0.5 hover:ring-2 hover:ring-stc-pink/35',
                sessionStore.slotCount >= 6
                  ? 'h-16 sm:h-[4.5rem]'
                  : sessionStore.slotCount === 4
                    ? 'h-20 sm:h-24'
                    : sessionStore.slotCount === 3
                      ? 'h-24 sm:h-28'
                      : 'h-32 sm:h-36',
              ]"
              :style="
                shotUrls[index - 1]
                  ? {
                      backgroundImage: `linear-gradient(180deg, transparent 35%, rgba(26,26,46,0.52) 100%), url(${shotUrls[index - 1]})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }
                  : undefined
              "
              @click="retakeShot(index - 1)"
            >
              <span
                class="absolute left-2 top-2 inline-flex min-w-7 items-center justify-center rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-stc-text shadow-sm"
              >
                {{ index }}
              </span>
              <span class="text-xs font-semibold text-white/95">
                {{ sessionStore.captureSource === 'upload' ? 'Ganti Foto' : `Foto ${index}` }}
              </span>
            </button>
          </div>

          <div class="border-t border-stc-border bg-white px-4 py-2 text-center">
            <span class="text-[10px] font-semibold uppercase tracking-[0.16em] text-stc-text-faint">
              stecute • {{ footerText }}
            </span>
          </div>
        </div>

        <div
          v-if="reviewError"
          class="w-full max-w-xl rounded-[24px] border border-stc-error/20 bg-stc-error-soft px-4 py-3 text-sm font-medium text-stc-error shadow-stc-sm"
        >
          {{ reviewError }}
        </div>

        <div class="flex w-full max-w-xl flex-col gap-3">
          <button :class="[ui.primaryButton, 'w-full']" @click="proceedToCustomize">
            Kustomisasi
          </button>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button :class="[ui.secondaryButton, 'w-full']" @click="retakeAll">
              Ulang Semua
            </button>
            <button :class="[ui.successButton, 'w-full']" @click="saveDirectly">
              Simpan Langsung
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
