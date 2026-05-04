<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getReviewSessionSnapshot, resetSessionData, saveShot } from '@/services/session'
import { getImageDimensions, openImagePicker, validateFile } from '@/services/upload'
import { getTemplateById } from '@/templates'
import { useCustomTemplateStore } from '@/app/store/useCustomTemplateStore'
import { useSessionStore } from '@/app/store/useSessionStore'
import { ui } from '@/ui/styles'
import { getLayoutById } from '@/layouts'
import StripCanvasPreview from '@/components/common/StripCanvasPreview.vue'
import FlowProgress from '@/components/common/FlowProgress.vue'

const router = useRouter()
const sessionStore = useSessionStore()
const customTemplateStore = useCustomTemplateStore()
const activeLayout = computed(
  () =>
    customTemplateStore.getLayoutById(sessionStore.layoutId) ??
    getLayoutById(sessionStore.layoutId),
)
const activeTemplate = computed(
  () =>
    customTemplateStore.getTemplateById(sessionStore.templateId) ??
    getTemplateById(sessionStore.templateId),
)

const shotUrls = ref<string[]>([])
const reviewError = ref<string | null>(null)
const isLoadingReview = ref(true)

function revokeShotUrls() {
  shotUrls.value.forEach((url) => URL.revokeObjectURL(url))
  shotUrls.value = []
}

async function loadShotUrls() {
  const snapshot = await getReviewSessionSnapshot(sessionStore.sessionId)

  if (!snapshot) {
    revokeShotUrls()
    reviewError.value = 'Sesi review tidak ditemukan. Mulai sesi baru untuk membuat strip.'
    isLoadingReview.value = false
    return
  }

  sessionStore.restoreFromSession(snapshot.session, snapshot.shots)
  revokeShotUrls()
  shotUrls.value = snapshot.shots.map((shot) => URL.createObjectURL(shot.blob))
  reviewError.value = null
  isLoadingReview.value = false
}

onMounted(async () => {
  await loadShotUrls()
})

onBeforeUnmount(() => {
  revokeShotUrls()
})

async function retakeAll() {
  const previousSource = sessionStore.captureSource ?? 'camera'
  if (sessionStore.sessionId) {
    await resetSessionData(sessionStore.sessionId)
  }
  sessionStore.reset()
  router.push({ path: '/config', query: { source: previousSource } })
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

function proceedToRender() {
  if (!sessionStore.sessionId || shotUrls.value.length < sessionStore.slotCount) {
    reviewError.value = 'Foto sesi belum lengkap. Muat ulang atau mulai sesi baru.'
    return
  }

  router.push('/render')
}
</script>

<template>
  <div :class="ui.page">
    <div :class="ui.header">
      <div class="min-w-0 flex-1 space-y-1">
        <h3 :class="ui.title">Preview</h3>
        <p :class="ui.subtitle">
          Ketuk slot foto jika ingin mengulang tangkapan sebelum hasil akhir.
        </p>
      </div>
      <span :class="ui.pinkBadge">
        {{ activeLayout?.printFormat.paperSize ?? `${sessionStore.slotCount} Foto` }}
      </span>
    </div>

    <FlowProgress current="review" :source="sessionStore.captureSource" />

    <div :class="[ui.content, 'flex flex-col']">
      <div :class="[ui.pageContent, 'items-center gap-8 text-center']">
        <div v-if="isLoadingReview" :class="ui.emptyPanel">
          <div :class="ui.surfaceIcon">
            <div
              class="border-r-stc-pink/30 border-t-stc-pink size-8 animate-spin rounded-full border-[3px] border-transparent"
            ></div>
          </div>
          <h4 class="text-stc-text text-xl font-bold">Memuat Review</h4>
          <p
            class="text-stc-text-soft mx-auto mt-3 max-w-sm text-[0.9375rem] leading-relaxed font-medium"
          >
            Mengambil ulang foto sesi dari penyimpanan lokal.
          </p>
        </div>

        <StripCanvasPreview
          v-else
          :layout="activeLayout"
          :template-config="activeTemplate"
          :shot-urls="shotUrls"
          interactive
          fit-viewport
          @retake="retakeShot"
          class="transition-transform duration-300 hover:scale-[1.02]"
        />

        <div
          v-if="reviewError"
          class="border-stc-error/30 bg-stc-error-soft text-stc-error shadow-stc-xs w-full max-w-xl rounded-xl border px-4 py-3 text-sm font-medium"
        >
          {{ reviewError }}
        </div>

        <div
          :class="[
            ui.bottomActions,
            'mt-auto max-w-xl flex-col-reverse justify-center sm:flex-row',
          ]"
        >
          <button :class="[ui.secondaryButton, 'w-full sm:flex-1']" @click="retakeAll">
            Ulang Semua
          </button>
          <button :class="[ui.primaryButton, 'w-full sm:flex-[2]']" @click="proceedToRender">
            Buat Hasil Akhir
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
