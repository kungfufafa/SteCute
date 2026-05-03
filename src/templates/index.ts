import type { LayoutConfig, TemplateConfig } from '@/db/schema'
import { classicTemplate } from './classic/config'
import { youthTemplate } from './youth/config'
import { monoTemplate } from './monochrome/config'
import { boothmansTemplate } from './boothmans/config'

export const templates: TemplateConfig[] = [
  classicTemplate,
  youthTemplate,
  monoTemplate,
  boothmansTemplate,
]

export function getTemplateById(id: string): TemplateConfig | undefined {
  return templates.find((t) => t.id === id)
}

export function isTemplateSupportedForLayout(
  template: TemplateConfig,
  layoutId: string | null | undefined,
): boolean {
  if (!layoutId) return true
  return !template.supportedLayoutIds || template.supportedLayoutIds.includes(layoutId)
}

export function getTemplatesForLayout(layoutId: string | null | undefined): TemplateConfig[] {
  return templates.filter((template) => isTemplateSupportedForLayout(template, layoutId))
}

export function resolveTemplateLayout(
  layout: LayoutConfig,
  template: TemplateConfig,
): LayoutConfig {
  const override = template.layoutOverrides?.[layout.id]

  if (!override) return layout

  return {
    ...layout,
    canvas: override.canvas,
    slots: override.slots,
  }
}
