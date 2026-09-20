<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useCustomTemplateStore } from '@/app/store/useCustomTemplateStore'
import { layouts, standardLayouts } from '@/layouts'
import { isTemplateSupportedForLayout, templates } from '@/templates'
import type { CaptureSessionConfig } from '@/services/session/capture-config'
import { ui } from '@/ui/styles'
import { createTemplateFromStripFile, openStripTemplatePicker } from '@/services/template-upload'

const props = withDefaults(
  defineProps<{
    modelValue: CaptureSessionConfig
    open: boolean
    disabled?: boolean
    busy?: boolean
    capturedCount?: number
    mode: 'solo' | 'duet'
  }>(),
  { disabled: false, busy: false, capturedCount: 0 },
)
const emit = defineEmits<{
  'update:open': [value: boolean]
  apply: [config: CaptureSessionConfig]
  restart: []
}>()
const customTemplateStore = useCustomTemplateStore()
const isUploadingTemplate = ref(false)
const uploadError = ref<string | null>(null)
let disposed = false
onUnmounted(() => {
  disposed = true
})
const editorRef = ref<HTMLFormElement | null>(null)
const draft = ref<CaptureSessionConfig>({ ...props.modelValue })
const availableTemplates = computed(() =>
  props.mode === 'duet'
    ? templates.filter((template) => !template.nativeLayout)
    : [...templates, ...customTemplateStore.templates],
)
const selectedTemplate = computed(() =>
  availableTemplates.value.find((template) => template.id === draft.value.templateId),
)
const availableLayouts = computed(() => {
  const template = selectedTemplate.value
  if (!template) return []
  if (template.nativeLayout) return [template.nativeLayout]
  return (props.mode === 'duet' ? standardLayouts : layouts).filter(
    (layout) =>
      !templates.some((candidate) => candidate.nativeLayout?.id === layout.id) &&
      isTemplateSupportedForLayout(template, layout.id),
  )
})
const currentTemplateName = computed(
  () =>
    availableTemplates.value.find((template) => template.id === props.modelValue.templateId)
      ?.name ?? 'Frame pilihan',
)
const locked = computed(() => props.capturedCount > 0)
const changed = computed(() =>
  (Object.keys(draft.value) as Array<keyof CaptureSessionConfig>).some(
    (key) => draft.value[key] !== props.modelValue[key],
  ),
)
const valid = computed(
  () =>
    Boolean(selectedTemplate.value) &&
    availableLayouts.value.some(
      (layout) => layout.id === draft.value.layoutId && layout.slotCount === draft.value.slotCount,
    ),
)

watch(
  [() => props.open, () => props.modelValue],
  () => {
    draft.value = { ...props.modelValue }
  },
  { deep: true },
)

watch(locked, (isLocked) => {
  if (isLocked && props.open) emit('update:open', false)
})

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    if (locked.value) {
      emit('update:open', false)
      return
    }
    await nextTick()
    editorRef.value?.scrollIntoView({ block: 'nearest' })
    editorRef.value?.querySelector('select')?.focus({ preventScroll: true })
  },
)

function openEditor() {
  if (locked.value || props.disabled || props.busy || isUploadingTemplate.value) return
  emit('update:open', true)
}

function selectTemplate(event: Event) {
  draft.value.templateId = (event.target as HTMLSelectElement).value
  const layout =
    availableLayouts.value.find((candidate) => candidate.id === draft.value.layoutId) ??
    availableLayouts.value.find((candidate) => candidate.slotCount === draft.value.slotCount) ??
    availableLayouts.value[0]
  if (layout) {
    draft.value.layoutId = layout.id
    draft.value.slotCount = layout.slotCount
  }
}

function selectLayout(event: Event) {
  const layout = availableLayouts.value.find(
    (candidate) => candidate.id === (event.target as HTMLSelectElement).value,
  )
  if (!layout) return
  draft.value.layoutId = layout.id
  draft.value.slotCount = layout.slotCount
}

async function uploadTemplate() {
  if (
    locked.value ||
    props.disabled ||
    props.busy ||
    isUploadingTemplate.value ||
    props.mode !== 'solo'
  )
    return
  isUploadingTemplate.value = true
  uploadError.value = null
  let unclaimedObjectUrl: string | null = null
  try {
    const file = await openStripTemplatePicker()
    if (!file || disposed || !props.open || locked.value) return
    const uploaded = await createTemplateFromStripFile({ file })
    unclaimedObjectUrl = uploaded.objectUrl
    if (disposed || !props.open || locked.value) return
    const layout = uploaded.template.nativeLayout
    if (!layout) throw new Error('Frame custom tidak punya layout valid.')
    await customTemplateStore.saveTemplate(uploaded)
    unclaimedObjectUrl = null
    if (disposed || !props.open || locked.value) return
    draft.value.templateId = uploaded.template.id
    draft.value.layoutId = layout.id
    draft.value.slotCount = layout.slotCount
  } catch (error) {
    if (!disposed)
      uploadError.value = error instanceof Error ? error.message : 'Gagal membaca frame custom.'
  } finally {
    if (unclaimedObjectUrl) URL.revokeObjectURL(unclaimedObjectUrl)
    isUploadingTemplate.value = false
  }
}

function apply() {
  if (
    locked.value ||
    props.disabled ||
    props.busy ||
    isUploadingTemplate.value ||
    !changed.value ||
    !valid.value
  )
    return
  emit('apply', { ...draft.value })
}
</script>

<template>
  <section
    class="border-stc-border mb-5 border-b pb-5"
    aria-label="Pengaturan sesi"
    data-testid="capture-session-settings"
  >
    <div class="flex items-start justify-between gap-3">
      <p
        class="text-stc-text-soft min-w-0 truncate text-xs leading-relaxed"
        aria-live="polite"
        :data-testid="locked ? 'capture-session-locked' : undefined"
      >
        {{
          locked
            ? 'Terkunci setelah foto pertama'
            : `${currentTemplateName} · ${modelValue.slotCount} pose`
        }}
      </p>
      <div class="flex shrink-0 items-center gap-2">
        <button
          v-if="locked"
          type="button"
          :class="ui.ghostButton"
          :disabled="disabled || busy || isUploadingTemplate"
          @click="emit('restart')"
        >
          Ulang semua foto
        </button>
        <button
          v-if="!open && !locked"
          type="button"
          :class="ui.secondaryButton"
          aria-label="Ubah pengaturan sesi"
          :disabled="disabled || busy || isUploadingTemplate"
          @click="openEditor"
        >
          Ubah
        </button>
      </div>
    </div>

    <form
      v-if="open && !locked"
      ref="editorRef"
      class="mt-4 space-y-3"
      data-testid="capture-session-editor"
      @submit.prevent="apply"
    >
      <fieldset :disabled="locked || disabled || busy || isUploadingTemplate" class="space-y-3">
        <label class="text-stc-text flex flex-col gap-1.5 text-xs font-medium">
          Frame
          <select :value="draft.templateId" :class="[ui.input, 'w-full']" @change="selectTemplate">
            <option v-for="template in availableTemplates" :key="template.id" :value="template.id">
              {{ template.name }}{{ template.nativeLayout ? ' · layout khusus' : '' }}
            </option>
          </select>
        </label>
        <button
          v-if="mode === 'solo'"
          type="button"
          :class="ui.secondaryButton"
          @click="uploadTemplate"
        >
          {{ isUploadingTemplate ? 'Membaca frame...' : 'Upload Frame' }}
        </button>
        <p v-if="uploadError" :class="ui.alertError" role="alert">{{ uploadError }}</p>
        <label class="text-stc-text flex flex-col gap-1.5 text-xs font-medium">
          Jumlah pose
          <select :value="draft.layoutId" :class="[ui.input, 'w-full']" @change="selectLayout">
            <option v-for="layout in availableLayouts" :key="layout.id" :value="layout.id">
              {{ layout.slotCount }} pose · {{ layout.printFormat.label }}
            </option>
          </select>
        </label>
        <label class="text-stc-text flex flex-col gap-1.5 text-xs font-medium">
          Timer
          <select v-model.number="draft.countdownSeconds" :class="[ui.input, 'w-full']">
            <option v-for="seconds in [3, 5, 10]" :key="seconds" :value="seconds">
              {{ seconds }} detik
            </option>
          </select>
        </label>
        <label class="text-stc-text flex items-center gap-2.5 py-1 text-xs font-medium">
          <input v-model="draft.autoCapture" type="checkbox" class="accent-stc-pink size-4" />
          Ambil foto otomatis
        </label>
      </fieldset>

      <div class="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          :class="ui.primaryButton"
          :disabled="locked || disabled || busy || isUploadingTemplate || !changed || !valid"
        >
          {{ busy ? 'Menerapkan...' : 'Terapkan' }}
        </button>
        <button
          type="button"
          :class="ui.secondaryButton"
          :disabled="busy || isUploadingTemplate"
          @click="emit('update:open', false)"
        >
          Batal
        </button>
      </div>
    </form>
  </section>
</template>
