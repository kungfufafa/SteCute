<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createDefaultDecorationConfig, createSession, saveShot } from '@/services/session'
import { useSessionStore } from '@/stores'
import { getImageDimensions, openImagePicker, validateFiles } from '@/services/upload'
import { ui } from '@/ui/styles'
import { getLayoutById } from '@/layouts'
import { getTemplateById } from '@/templates'

const router = useRouter()
const sessionStore = useSessionStore()
const activeLayout = getLayoutById(sessionStore.layoutId)
const errors = ref<string[]>([])
const selectedFiles = ref<File[]>([])
const previewUrls = ref<string[]>([])

const isProcessing = ref(false)

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`
  }

  if (error && typeof error === 'object') {
    const details = error as { name?: unknown; message?: unknown; code?: unknown }
    return JSON.stringify({
      name: details.name,
      message: details.message,
      code: details.code,
    })
  }

  return String(error)
}

function resetPreviewUrls() {
  previewUrls.value.forEach((url) => URL.revokeObjectURL(url))
  previewUrls.value = []
}

function setSelectedFiles(files: File[]) {
  resetPreviewUrls()
  selectedFiles.value = files
  previewUrls.value = files.map((file) => URL.createObjectURL(file))
}

async function handleFileSelect() {
  if (isProcessing.value) return

  const files = await openImagePicker(true)
  if (!files) return

  const selected = Array.from(files)
  const validation = validateFiles(selected, sessionStore.slotCount)

  if (!validation.valid) {
    errors.value = validation.errors
    return
  }

  setSelectedFiles(selected)
  errors.value = []
  void processUpload()
}

function goBack() {
  router.push('/')
}

function removeAt(index: number) {
  const next = selectedFiles.value.filter((_, currentIndex) => currentIndex !== index)
  setSelectedFiles(next)
}

async function processUpload() {
  if (selectedFiles.value.length === 0) return

  isProcessing.value = true
  let sessionId: string | undefined

  try {
    sessionId = await createSession({
      layoutId: sessionStore.layoutId,
      templateId: sessionStore.templateId,
      slotCount: sessionStore.slotCount,
      captureSource: 'upload',
      decoration: createDefaultDecorationConfig(getTemplateById(sessionStore.templateId)),
    })

    sessionStore.startSession(sessionId, 'upload', sessionStore.slotCount)

    for (const [index, file] of selectedFiles.value.entries()) {
      const size = await getImageDimensions(file)
      const blob = new Blob([await file.arrayBuffer()], { type: file.type })
      const shotId = await saveShot({
        sessionId,
        order: index,
        sourceType: 'upload',
        blob,
        width: size.width,
        height: size.height,
      })
      sessionStore.addShotId(shotId)
    }

    sessionStore.setReviewing()
    router.push('/review')
  } catch (error) {
    console.error(`Upload failed: ${describeError(error)}`)
    if (sessionId) {
      const { resetSessionData } = await import('@/services/session')
      await resetSessionData(sessionId).catch(() => {})
    }
    errors.value = ['Gagal memproses foto. Silakan coba lagi.']
  } finally {
    isProcessing.value = false
  }
}

onBeforeUnmount(() => resetPreviewUrls())
</script>

<template>
  <div :class="ui.page">
    <div :class="ui.header">
      <div :class="ui.headerGroup">
        <button :class="ui.iconButton" aria-label="Kembali ke beranda" @click="goBack">
          <svg
            width="18"
            height="18"
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
          <h3 :class="ui.title">Upload Foto</h3>
          <p :class="ui.subtitle">
            Pilih tepat {{ sessionStore.slotCount }} foto untuk
            {{ activeLayout?.printFormat.label ?? 'format strip yang aktif' }}.
          </p>
        </div>
      </div>
      <span :class="ui.badge">{{
        activeLayout?.printFormat.paperSize ?? `${sessionStore.slotCount} Foto`
      }}</span>
    </div>

    <div :class="ui.content">
      <div :class="[ui.contentWrap, 'gap-6']">
        <div class="space-y-3">
          <p class="text-stc-text-soft text-sm leading-relaxed">
            Gunakan format JPG, PNG, atau WebP maksimal 10 MB per file. Semua foto akan diproses
            lokal di perangkat ini.
          </p>
        </div>

        <button
          class="group border-stc-border-strong shadow-stc-xs hover:border-stc-pink hover:bg-stc-pink-soft flex min-h-72 flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-white px-6 py-10 text-center transition-colors duration-150"
          :disabled="isProcessing"
          @click="handleFileSelect"
        >
          <div
            class="bg-stc-pink-soft text-stc-pink mb-4 flex size-16 items-center justify-center rounded-2xl"
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <h4 class="text-stc-text text-lg font-semibold">
            {{ isProcessing ? 'Memproses...' : 'Pilih Foto' }}
          </h4>
          <p class="text-stc-text-faint mt-2 text-sm">
            {{ isProcessing ? 'Menyiapkan preview' : 'JPG, PNG, WebP • Maks 10 MB per file' }}
          </p>
        </button>

        <div class="flex flex-wrap gap-3">
          <template v-for="(url, index) in previewUrls" :key="url">
            <div
              class="group border-stc-border shadow-stc-xs relative h-24 w-20 overflow-hidden rounded-xl border bg-white"
            >
              <img :src="url" :alt="`Upload ${index + 1}`" class="h-full w-full object-cover" />
              <button
                class="bg-stc-error shadow-stc-xs hover:bg-stc-error-strong absolute top-1 right-1 inline-flex size-6 items-center justify-center rounded-full border border-white/80 text-xs font-bold text-white transition-colors duration-150"
                :aria-label="`Hapus foto ${index + 1}`"
                :disabled="isProcessing"
                @click.stop="removeAt(index)"
              >
                ×
              </button>
            </div>
          </template>

          <button
            v-if="selectedFiles.length < sessionStore.slotCount"
            class="border-stc-pink bg-stc-pink-soft text-stc-pink flex h-24 w-20 items-center justify-center rounded-xl border border-dashed text-sm font-semibold transition-colors duration-150 hover:bg-white"
            :disabled="isProcessing"
            @click="handleFileSelect"
          >
            +{{ sessionStore.slotCount - selectedFiles.length }}
          </button>
        </div>

        <div
          v-if="errors.length > 0"
          class="border-stc-error/20 bg-stc-error-soft shadow-stc-xs rounded-2xl border p-5"
        >
          <p class="text-stc-error mb-3 text-xs font-bold tracking-[0.16em] uppercase">
            Masalah Upload
          </p>
          <div class="space-y-2">
            <div
              v-for="(error, index) in errors"
              :key="error"
              class="text-stc-error flex items-start gap-3 text-sm"
            >
              <span
                class="text-stc-error mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold"
              >
                {{ index + 1 }}
              </span>
              <span>{{ error }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
