import type { TemplateConfig } from '@/db/schema'
import { classicTemplate } from './classic/config'
import { youthTemplate } from './youth/config'
import { monoTemplate } from './monochrome/config'

export const templates: TemplateConfig[] = [classicTemplate, youthTemplate, monoTemplate]

export function getTemplateById(id: string): TemplateConfig | undefined {
  return templates.find((t) => t.id === id)
}
