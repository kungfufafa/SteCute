import type { LayoutConfig } from '@/db/schema'
import { strip2Config } from './strip-2/config'
import { strip3Config } from './strip-3/config'
import { strip4Config } from './strip-4/config'
import { strip6Config } from './strip-6/config'

export const layouts: LayoutConfig[] = [strip2Config, strip3Config, strip4Config, strip6Config]

export function getLayoutById(id: string): LayoutConfig | undefined {
  return layouts.find((l) => l.id === id)
}

export function getLayoutBySlotCount(count: number): LayoutConfig | undefined {
  return layouts.find((l) => l.slotCount === count)
}
