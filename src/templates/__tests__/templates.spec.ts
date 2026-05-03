import { describe, expect, it } from 'vitest'
import { getTemplatesForLayout, resolveTemplateLayout } from '@/templates'
import { strip3Config } from '@/layouts/strip-3/config'
import { strip4Config } from '@/layouts/strip-4/config'
import { boothmansTemplate } from '@/templates/boothmans/config'
import { classicTemplate } from '@/templates/classic/config'

describe('template registry', () => {
  it('filters layout-specific blanko templates', () => {
    expect(getTemplatesForLayout('strip-3-vertical').map((template) => template.id)).toContain(
      'boothmans-strip',
    )
    expect(getTemplatesForLayout('strip-4-vertical').map((template) => template.id)).not.toContain(
      'boothmans-strip',
    )
  })

  it('uses a template-specific render layout when a raster blanko needs it', () => {
    const layout = resolveTemplateLayout(strip3Config, boothmansTemplate)

    expect(layout.canvas).toEqual({ width: 1200, height: 3602 })
    expect(layout.slots).toHaveLength(3)
    expect(layout.slots[0]).toMatchObject({ x: 72, y: 329, width: 1056, height: 707 })
  })

  it('keeps the base layout for generated templates', () => {
    expect(resolveTemplateLayout(strip4Config, classicTemplate)).toBe(strip4Config)
  })
})
