<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createDefaultDecorationConfig, createSession, saveShot } from '@/services/session'
import { useSessionStore } from '@/stores'
import { getImageDimensions, openImagePicker, validateFiles } from '@/services/upload'
import { ui } from '@/ui/styles'
import { getLayoutById } from '@/layouts'
import { getTemplateById } from '@/templates'
import StripCanvasPreview from '@/components/common/StripCanvasPreview.vue'
import FlowProgress from '@/components/common/FlowProgress.vue'

const router = useRouter()
const sessionStore = useSessionStore()
const activeLayout = getLayoutById(sessionStore.layoutId)
const activeTemplate = computed(() => getTemplateById(sessionStore.templateId))
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
  router.push({ path: '/config', query: { source: 'upload' } })
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
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
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
            Pilih tepat {{ sessionStore.slotCount }} foto untuk strip Anda.
          </p>
        </div>
      </div>
      <span :class="ui.badge">{{
        activeLayout?.printFormat.paperSize ?? `${sessionStore.slotCount} Foto`
      }}</span>
    </div>

    <FlowProgress current="capture" source="upload" />

    <div :class="ui.content">
      <div
        :class="[
          ui.pageContentWide,
          'grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start',
        ]"
      >
        <section class="min-w-0 space-y-6">
          <div class="max-w-2xl space-y-2">
            <p :class="ui.sectionLabel">Upload Lokal</p>
            <h2 :class="ui.sectionTitle">Masukkan foto sesuai slot.</h2>
            <p :class="ui.sectionCopy">
              JPG, PNG, atau WebP maksimal 10 MB per file. Semua foto diproses lokal di perangkat
              ini untuk menjaga privasi.
            </p>
          </div>

          <button
            class="group border-stc-border-strong shadow-stc-xs hover:border-stc-pink hover:bg-stc-pink-soft hover:shadow-stc-sm focus-visible:ring-stc-pink flex min-h-[280px] w-full max-w-[38rem] flex-col items-center justify-center rounded-xl border-2 border-dashed bg-white px-5 py-8 text-center transition-all duration-200 outline-none hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-offset-2 active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 sm:min-h-[330px] sm:px-6 sm:py-10"
            :disabled="isProcessing"
            @click="handleFileSelect"
          >
            <div
              class="bg-stc-pink-soft text-stc-pink shadow-stc-xs mb-5 flex size-16 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105 sm:size-20"
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <h4
              class="text-stc-text group-hover:text-stc-pink-strong text-xl font-bold transition-colors"
            >
              {{ isProcessing ? 'Memproses...' : 'Pilih Foto Lokal' }}
            </h4>
            <p
              class="text-stc-text-faint group-hover:text-stc-pink/80 mt-2 text-sm font-medium transition-colors"
            >
              {{
                isProcessing
                  ? 'Menyiapkan preview'
                  : `${sessionStore.slotCount} file untuk sekali render`
              }}
            </p>
          </button>

          <div v-if="previewUrls.length > 0" class="flex flex-wrap gap-4">
            <template v-for="(url, index) in previewUrls" :key="url">
              <div
                class="border-stc-border shadow-stc-sm relative h-28 w-24 overflow-hidden rounded-xl border-2 bg-white"
              >
                <img
                  :src="url"
                  :alt="`Upload ${index + 1}`"
                  class="h-full w-full object-cover transition-transform duration-500 hover:scale-110"
                />
                <button
                  class="bg-stc-error shadow-stc-xs hover:bg-stc-error-strong absolute top-1.5 right-1.5 flex size-7 items-center justify-center rounded-full border-[2px] border-white text-sm font-bold text-white transition-all duration-200 outline-none hover:scale-110 active:scale-90"
                  :aria-label="`Hapus foto ${index + 1}`"
                  :disabled="isProcessing"
                  @click.stop="removeAt(index)"
                >
                  &times;
                </button>
              </div>
            </template>

            <button
              v-if="selectedFiles.length < sessionStore.slotCount"
              class="border-stc-pink bg-stc-pink-soft text-stc-pink hover:shadow-stc-sm flex h-28 w-24 items-center justify-center rounded-xl border-2 border-dashed text-lg font-bold transition-all duration-200 outline-none hover:-translate-y-1 hover:bg-white active:translate-y-0 active:scale-95 disabled:pointer-events-none disabled:opacity-60"
              :disabled="isProcessing"
              @click="handleFileSelect"
            >
              +{{ sessionStore.slotCount - selectedFiles.length }}
            </button>
          </div>

          <div
            v-if="errors.length > 0"
            class="border-stc-error/30 bg-stc-error-soft shadow-stc-xs rounded-xl border p-5 sm:p-6"
          >
            <p class="text-stc-error mb-4 text-[0.6875rem] font-bold uppercase">Masalah Upload</p>
            <div class="space-y-3">
              <div
                v-for="(error, index) in errors"
                :key="error"
                class="text-stc-error flex items-start gap-3 text-sm font-medium"
              >
                <span
                  class="text-stc-error shadow-stc-xs mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold"
                >
                  {{ index + 1 }}
                </span>
                <span class="leading-relaxed">{{ error }}</span>
              </div>
            </div>
          </div>
        </section>

        <aside class="lg:sticky lg:top-8" aria-label="Ringkasan format upload">
          <div :class="[ui.panel, 'p-5 sm:p-6']">
            <div class="mb-5 flex items-start justify-between gap-4">
              <div>
                <p :class="ui.sectionLabel">Slot</p>
                <h3 class="text-stc-text mt-1 text-lg font-bold">
                  {{ activeLayout?.printFormat.label ?? `${sessionStore.slotCount} Foto` }}
                </h3>
              </div>
              <span :class="ui.badge">{{ sessionStore.slotCount }} Foto</span>
            </div>

            <div class="mx-auto max-w-[190px]">
              <StripCanvasPreview :layout="activeLayout" :template-config="activeTemplate" />
            </div>

            <div class="mt-6 space-y-3">
              <div :class="['flex items-center justify-between gap-4', ui.softTile]">
                <span class="text-stc-text-soft text-sm font-semibold">Template</span>
                <span class="text-stc-text text-sm font-bold">
                  {{ activeTemplate?.name ?? 'Classic' }}
                </span>
              </div>
              <div :class="['flex items-center justify-between gap-4', ui.softTile]">
                <span class="text-stc-text-soft text-sm font-semibold">Format</span>
                <span class="text-stc-text text-sm font-bold">JPG/PNG/WebP</span>
              </div>
              <div :class="['flex items-center justify-between gap-4', ui.softTile]">
                <span class="text-stc-text-soft text-sm font-semibold">Batas file</span>
                <span class="text-stc-text text-sm font-bold">10 MB</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>
