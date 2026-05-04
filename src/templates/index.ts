import type { LayoutConfig, TemplateConfig } from '@/db/schema'
import { classicTemplate } from './classic/config'
import { youthTemplate } from './youth/config'
import { monoTemplate } from './monochrome/config'

export const templates: TemplateConfig[] = [classicTemplate, youthTemplate, monoTemplate]

export function getTemplateById(id: string): TemplateConfig | undefined {
  return templates.find((t) => t.id === id)
}

export function isTemplateSupportedForLayout(
  template: TemplateConfig,
  layoutId: string | null | undefined,
): boolean {
  if (!layoutId) return true
  if (template.nativeLayout?.id === layoutId) return true
  if (template.nativeLayout && !template.supportedLayoutIds) return false
  return !template.supportedLayoutIds || template.supportedLayoutIds.includes(layoutId)
}

export function getTemplatesForLayout(layoutId: string | null | undefined): TemplateConfig[] {
  const nativeTemplates = templates.filter((template) => template.nativeLayout?.id === layoutId)

  if (nativeTemplates.length > 0) return nativeTemplates

  return templates.filter(
    (template) => !template.nativeLayout && isTemplateSupportedForLayout(template, layoutId),
  )
}

export function getTemplateNativeLayouts(): LayoutConfig[] {
  return templates.flatMap((template) => (template.nativeLayout ? [template.nativeLayout] : []))
}

export function resolveTemplateLayout(
  layout: LayoutConfig,
  template: TemplateConfig,
): LayoutConfig {
  const override = template.layoutOverrides?.[layout.id]

  if (template.nativeLayout?.id === layout.id) return template.nativeLayout
  if (!override) return layout

  return {
    ...layout,
    canvas: override.canvas,
    slots: override.slots,
  }
}
