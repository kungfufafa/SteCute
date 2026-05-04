import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { LayoutConfig, TemplateConfig } from '@/db/schema'
import {
  loadUploadedStripTemplates,
  persistUploadedStripTemplate,
  type UploadedStripTemplate,
} from '@/services/template-upload'

export const CUSTOM_TEMPLATE_ID = 'custom-strip'

export const useCustomTemplateStore = defineStore('custom-template', () => {
  const templates = ref<TemplateConfig[]>([])
  const objectUrls = ref<Record<string, string>>({})
  let hasLoadedPersistedTemplates = false
  let loadPersistedTemplatesPromise: Promise<void> | null = null

  const template = computed(() => templates.value.at(-1) ?? null)
  const layout = computed(() => template.value?.nativeLayout ?? null)
  const hasTemplate = computed(() => templates.value.length > 0)

  function setTemplate(nextTemplate: TemplateConfig, nextObjectUrl: string) {
    upsertRuntimeTemplate(nextTemplate, nextObjectUrl)
  }

  async function saveTemplate(uploaded: UploadedStripTemplate) {
    await persistUploadedStripTemplate(uploaded)
    upsertRuntimeTemplate(uploaded.template, uploaded.objectUrl)
  }

  async function loadPersistedTemplates() {
    if (hasLoadedPersistedTemplates) return
    if (loadPersistedTemplatesPromise) return loadPersistedTemplatesPromise

    loadPersistedTemplatesPromise = loadUploadedStripTemplates()
      .then((uploadedTemplates) => {
        mergeRuntimeTemplates(uploadedTemplates)
        hasLoadedPersistedTemplates = true
      })
      .finally(() => {
        loadPersistedTemplatesPromise = null
      })

    return loadPersistedTemplatesPromise
  }

  function getTemplateById(templateId: string): TemplateConfig | undefined {
    return templates.value.find((item) => item.id === templateId)
  }

  function getLayoutById(layoutId: string): LayoutConfig | undefined {
    return templates.value.find((item) => item.nativeLayout?.id === layoutId)?.nativeLayout
  }

  function clearTemplate(templateId?: string) {
    if (!templateId) {
      Object.values(objectUrls.value).forEach((url) => URL.revokeObjectURL(url))
      templates.value = []
      objectUrls.value = {}
      return
    }

    revokeObjectUrl(templateId)
    templates.value = templates.value.filter((item) => item.id !== templateId)
  }

  function mergeRuntimeTemplates(uploadedTemplates: UploadedStripTemplate[]) {
    for (const uploaded of uploadedTemplates) {
      upsertRuntimeTemplate(uploaded.template, uploaded.objectUrl)
    }
  }

  function upsertRuntimeTemplate(nextTemplate: TemplateConfig, nextObjectUrl: string) {
    const currentUrl = objectUrls.value[nextTemplate.id]

    if (currentUrl && currentUrl !== nextObjectUrl) {
      URL.revokeObjectURL(currentUrl)
    }

    templates.value = [
      ...templates.value.filter((item) => item.id !== nextTemplate.id),
      nextTemplate,
    ]
    objectUrls.value = {
      ...objectUrls.value,
      [nextTemplate.id]: nextObjectUrl,
    }
  }

  function revokeObjectUrl(templateId: string) {
    const currentUrl = objectUrls.value[templateId]

    if (!currentUrl) return

    URL.revokeObjectURL(currentUrl)
    const remainingUrls = { ...objectUrls.value }
    delete remainingUrls[templateId]
    objectUrls.value = remainingUrls
  }

  return {
    templates,
    template,
    layout,
    objectUrls,
    hasTemplate,
    setTemplate,
    saveTemplate,
    loadPersistedTemplates,
    getTemplateById,
    getLayoutById,
    clearTemplate,
  }
})
