import { describe, expect, it } from 'vitest'
import { getTemplateNativeLayouts, getTemplatesForLayout, resolveTemplateLayout } from '@/templates'
import { strip4Config } from '@/layouts/strip-4/config'
import { classicTemplate } from '@/templates/classic/config'

describe('template registry', () => {
  it('keeps standard templates available for standard formats', () => {
    expect(getTemplatesForLayout('strip-3-vertical').map((template) => template.id)).toEqual([
      'classic',
      'youth',
      'mono',
    ])
  })

  it('does not expose sample public template layouts as active bundled templates', () => {
    expect(getTemplateNativeLayouts()).toEqual([])
  })

  it('keeps the base layout for generated templates', () => {
    expect(resolveTemplateLayout(strip4Config, classicTemplate)).toBe(strip4Config)
  })
})
