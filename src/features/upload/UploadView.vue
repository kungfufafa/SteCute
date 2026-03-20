<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createDecorationConfig, createSession, saveShot } from '@/services/session'
import { useSessionStore } from '@/stores'
import { getImageDimensions, openImagePicker, validateFiles } from '@/services/upload'
import { ui } from '@/ui/styles'
import { getLayoutById } from '@/layouts'

const router = useRouter()
const sessionStore = useSessionStore()
const activeLayout = getLayoutById(sessionStore.layoutId)
const errors = ref<string[]>([])
const selectedFiles = ref<File[]>([])
const previewUrls = ref<string[]>([])

const isProcessing = ref(false)

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
}

function goBack() {
  router.push('/')
}

function proceed() {
  if (selectedFiles.value.length === 0) return
  void processUpload()
}

function removeAt(index: number) {
  const next = selectedFiles.value.filter((_, currentIndex) => currentIndex !== index)
  setSelectedFiles(next)
}

async function processUpload() {
  isProcessing.value = true
  let sessionId: string | undefined

  try {
    sessionId = await createSession({
      layoutId: sessionStore.layoutId,
      templateId: sessionStore.templateId,
      slotCount: sessionStore.slotCount,
      captureSource: 'upload',
      decoration: createDecorationConfig(),
    })

    sessionStore.startSession(sessionId, 'upload', sessionStore.slotCount)

    for (const [index, file] of selectedFiles.value.entries()) {
      const size = await getImageDimensions(file)
      const shotId = await saveShot({
        sessionId,
        order: index,
        sourceType: 'upload',
        blob: file,
        width: size.width,
        height: size.height,
      })
      sessionStore.addShotId(shotId)
    }

    sessionStore.setReviewing()
    router.push('/review')
  } catch (error) {
    console.error('Upload failed:', error)
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
        <button :class="ui.iconButton" @click="goBack">
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
      <span :class="ui.badge">{{ activeLayout?.printFormat.paperSize ?? `${sessionStore.slotCount} Foto` }}</span>
    </div>

    <div :class="ui.content">
      <div :class="[ui.contentWrap, 'gap-6']">
        <div class="space-y-3">
          <p class="text-sm leading-relaxed text-stc-text-soft">
            Gunakan format JPG, PNG, atau WebP maksimal 10 MB per file. Semua foto akan diproses
            lokal di perangkat ini.
          </p>
        </div>

        <button
          class="group flex min-h-72 flex-1 flex-col items-center justify-center rounded-[32px] border-2 border-dashed border-stc-border-strong bg-white px-6 py-10 text-center shadow-stc-sm transition-all duration-200 hover:-translate-y-1 hover:border-stc-pink hover:bg-stc-pink-soft"
          @click="handleFileSelect"
        >
          <div
            class="mb-4 flex size-16 items-center justify-center rounded-2xl bg-stc-pink-soft text-stc-pink transition-transform duration-200 group-hover:scale-105"
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
          <h4 class="text-lg font-semibold text-stc-text">Pilih Foto</h4>
          <p class="mt-2 text-sm text-stc-text-faint">JPG, PNG, WebP • Maks 10 MB per file</p>
        </button>

        <div class="flex flex-wrap gap-3">
          <template v-for="(url, index) in previewUrls" :key="url">
            <div
              class="group relative h-24 w-20 overflow-hidden rounded-2xl border border-stc-border bg-white shadow-stc-sm"
            >
              <img
                :src="url"
                :alt="`Upload ${index + 1}`"
                class="h-full w-full object-cover"
              />
              <button
                class="absolute right-1 top-1 inline-flex size-6 items-center justify-center rounded-full border border-white/80 bg-stc-error text-xs font-bold text-white shadow-sm transition-transform duration-200 hover:scale-105"
                @click.stop="removeAt(index)"
              >
                ×
              </button>
            </div>
          </template>

          <button
            v-if="selectedFiles.length < sessionStore.slotCount"
            class="flex h-24 w-20 items-center justify-center rounded-2xl border border-dashed border-stc-pink bg-stc-pink-soft text-sm font-semibold text-stc-pink transition-all duration-200 hover:-translate-y-0.5"
            @click="handleFileSelect"
          >
            +{{ sessionStore.slotCount - selectedFiles.length }}
          </button>
        </div>

        <div v-if="errors.length > 0" class="rounded-[28px] border border-stc-error/20 bg-stc-error-soft p-5 shadow-stc-sm">
          <p class="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-stc-error">Masalah Upload</p>
          <div class="space-y-2">
            <div
              v-for="(error, index) in errors"
              :key="error"
              class="flex items-start gap-3 text-sm text-stc-error"
            >
              <span
                class="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-stc-error"
              >
                {{ index + 1 }}
              </span>
              <span>{{ error }}</span>
            </div>
          </div>
        </div>

        <div class="mt-auto pb-2">
          <button
            :class="[ui.primaryButton, 'w-full sm:w-auto sm:min-w-56']"
            :disabled="selectedFiles.length !== sessionStore.slotCount || isProcessing"
            @click="proceed"
          >
            Lanjut ke Preview
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
