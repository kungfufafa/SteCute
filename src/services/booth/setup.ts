import { getLayoutById, standardLayouts } from '@/layouts'
import { getTemplateById, templates } from '@/templates'
import { normalizeCameraEffectId } from '@/services/camera-effects'
import { normalizePhotoFilterId } from '@/services/filter'
import { normalizeVirtualBackgroundId } from '@/services/virtual-background'
import { DEFAULT_PAIR_SLOT } from './compose'

export const BOOTH_COUNTDOWN_SECONDS = [3, 5, 10] as const
export const DEFAULT_BOOTH_COUNTDOWN_SECONDS = 3
export const DEFAULT_BOOTH_LAYOUT_ID = 'strip-3-vertical'
export const DEFAULT_BOOTH_TEMPLATE_ID = 'classic'

export type BoothSessionSetup = {
  layoutId: string
  templateId: string
  slotCount: number
  countdownMs: number
  filterId: string
  cameraEffectId: string
  virtualBackgroundId: string
  virtualBackgroundAssetId?: string | null
  revision: number
}
export function bundledBoothLayouts() {
  return standardLayouts
}

export function bundledBoothTemplates() {
  return templates.filter((template) => !template.nativeLayout)
}

export function createDefaultBoothSetup(): BoothSessionSetup {
  const layout = getLayoutById(DEFAULT_BOOTH_LAYOUT_ID) ?? standardLayouts[0]
  const template = getTemplateById(DEFAULT_BOOTH_TEMPLATE_ID) ?? templates[0]

  return {
    layoutId: layout.id,
    templateId: template.id,
    slotCount: layout.slotCount,
    countdownMs: DEFAULT_BOOTH_COUNTDOWN_SECONDS * 1000,
    filterId: 'normal',
    cameraEffectId: 'none',
    virtualBackgroundId: 'off',
    virtualBackgroundAssetId: null,
    revision: 1,
  }
}

export function normalizeBoothCountdownMs(countdownMs?: number | null): number {
  const seconds = Math.round((countdownMs ?? DEFAULT_BOOTH_COUNTDOWN_SECONDS * 1000) / 1000)
  if ((BOOTH_COUNTDOWN_SECONDS as readonly number[]).includes(seconds)) {
    return seconds * 1000
  }
  return DEFAULT_BOOTH_COUNTDOWN_SECONDS * 1000
}

export function normalizeBoothSetup(input?: Partial<BoothSessionSetup> | null): BoothSessionSetup {
  const fallback = createDefaultBoothSetup()
  const bundledLayoutIds = new Set(bundledBoothLayouts().map((layout) => layout.id))
  const bundledTemplateIds = new Set(bundledBoothTemplates().map((template) => template.id))
  const layout =
    (input?.layoutId && bundledLayoutIds.has(input.layoutId)
      ? getLayoutById(input.layoutId)
      : null) ??
    getLayoutById(fallback.layoutId) ??
    bundledBoothLayouts()[0]
  const template =
    (input?.templateId && bundledTemplateIds.has(input.templateId)
      ? getTemplateById(input.templateId)
      : null) ??
    getTemplateById(fallback.templateId) ??
    bundledBoothTemplates()[0]

  return {
    layoutId: layout.id,
    templateId: template.id,
    slotCount: layout.slotCount,
    countdownMs: normalizeBoothCountdownMs(input?.countdownMs),
    filterId: normalizePhotoFilterId(input?.filterId),
    cameraEffectId: normalizeCameraEffectId(input?.cameraEffectId),
    virtualBackgroundId: normalizeVirtualBackgroundId(input?.virtualBackgroundId),
    virtualBackgroundAssetId: input?.virtualBackgroundAssetId
      ? String(input.virtualBackgroundAssetId)
      : null,
    revision: Math.max(1, Math.round(Number(input?.revision) || 1)),
  }
}

export function pairSlotForLayout(layoutId: string): { width: number; height: number } {
  const slot = getLayoutById(layoutId)?.slots[0]
  if (!slot) return { width: DEFAULT_PAIR_SLOT.width, height: DEFAULT_PAIR_SLOT.height }
  return { width: slot.width, height: slot.height }
}

export function boothSetupsEqual(
  left: BoothSessionSetup | null | undefined,
  right: BoothSessionSetup | null | undefined,
): boolean {
  if (!left || !right) return left === right
  return (
    left.layoutId === right.layoutId &&
    left.templateId === right.templateId &&
    left.slotCount === right.slotCount &&
    left.countdownMs === right.countdownMs &&
    left.filterId === right.filterId &&
    left.cameraEffectId === right.cameraEffectId &&
    left.virtualBackgroundId === right.virtualBackgroundId &&
    left.virtualBackgroundAssetId === right.virtualBackgroundAssetId &&
    left.revision === right.revision
  )
}
