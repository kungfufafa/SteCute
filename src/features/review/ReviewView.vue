<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getSessionShots, resetSessionData, saveShot } from '@/services/session'
import { getImageDimensions, openImagePicker, validateFile } from '@/services/upload'
import { getTemplateById } from '@/templates'
import { useSessionStore } from '@/stores'
import { ui } from '@/ui/styles'
import { getLayoutById } from '@/layouts'
import StripCanvasPreview from '@/components/common/StripCanvasPreview.vue'

const router = useRouter()
const sessionStore = useSessionStore()
const activeLayout = computed(() => getLayoutById(sessionStore.layoutId))
const activeTemplate = computed(() => getTemplateById(sessionStore.templateId))

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
  const previousSource = sessionStore.captureSource
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
        <StripCanvasPreview
          :layout="activeLayout"
          :template-config="activeTemplate"
          :shot-urls="shotUrls"
          interactive
          @retake="retakeShot"
        />

        <div
          v-if="reviewError"
          class="border-stc-error/20 bg-stc-error-soft text-stc-error shadow-stc-xs w-full max-w-xl rounded-xl border px-4 py-3 text-sm font-medium"
        >
          {{ reviewError }}
        </div>

        <div class="flex w-full max-w-xl flex-col gap-3">
          <button :class="[ui.primaryButton, 'w-full']" @click="proceedToRender">Buat Hasil</button>
          <button :class="[ui.secondaryButton, 'w-full']" @click="retakeAll">Ulang Semua</button>
        </div>
      </div>
    </div>
  </div>
</template>
