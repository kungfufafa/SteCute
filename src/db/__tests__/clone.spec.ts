import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { cloneFaceBounds, cloneShotRecord } from '../clone'

describe('indexeddb clone helpers', () => {
  it('turns Vue reactive face bounds into structured-cloneable records', () => {
    const bounds = reactive([{ x: 0.1, y: 0.2, width: 0.3, height: 0.4 }])
    const cloned = cloneFaceBounds(bounds)

    expect(cloned).toEqual([{ x: 0.1, y: 0.2, width: 0.3, height: 0.4 }])
    expect(() => structuredClone(cloned)).not.toThrow()
  })

  it('does not spread extra reactive fields onto a shot record', () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
    const reactiveShot = reactive({
      sessionId: 'session-1',
      order: 0,
      sourceType: 'camera' as const,
      blob,
      width: 10,
      height: 8,
      faceBounds: [{ x: 0.2, y: 0.1, width: 0.4, height: 0.5 }],
      cameraEffectId: 'hearts',
      cameraEffectFrameMs: 12,
      createdAt: 1,
      extraCanvas: { not: 'cloneable-enough' },
    })

    const record = cloneShotRecord(reactiveShot, 'shot-1')
    expect(record.id).toBe('shot-1')
    expect(record.faceBounds).toEqual([{ x: 0.2, y: 0.1, width: 0.4, height: 0.5 }])
    expect('extraCanvas' in record).toBe(false)
    expect(() => structuredClone({ ...record, blob: undefined })).not.toThrow()
  })
})
