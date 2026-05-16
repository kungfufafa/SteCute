import { describe, expect, it } from 'vitest'
import {
  CAMERA_EFFECTS,
  getCameraEffectById,
  normalizeCameraEffectId,
  isFaceTrackingEffect,
  normalizeCameraEffectFrameMs,
  CAMERA_EFFECT_LOOP_MS,
  getCameraEffectAssetManifest,
  resolveFaceTrackingEffectFaces,
} from '@/services/camera-effects'

describe('camera effects', () => {
  it('exposes local camera overlay presets', () => {
    expect(CAMERA_EFFECTS.map((effect) => effect.id)).toEqual([
      'none',
      'hearts',
      'bluebirds',
      'kicau-mania',
      'windut',
    ])
  })

  it('falls back to no overlay for unknown ids', () => {
    expect(getCameraEffectById('missing').id).toBe('none')
    expect(normalizeCameraEffectId('missing')).toBe('none')
    expect(getCameraEffectById('reactions').id).toBe('none')
    expect(normalizeCameraEffectId('reaction-hearts')).toBe('none')
  })

  it('identifies face-tracking effects correctly', () => {
    expect(isFaceTrackingEffect('hearts')).toBe(true)
    expect(isFaceTrackingEffect('bluebirds')).toBe(true)
    expect(isFaceTrackingEffect('kicau-mania')).toBe(true)
    expect(isFaceTrackingEffect('windut')).toBe(true)
    expect(isFaceTrackingEffect('reactions')).toBe(false)
    expect(isFaceTrackingEffect('sparkles')).toBe(false)
    expect(isFaceTrackingEffect('none')).toBe(false)
    expect(isFaceTrackingEffect(null)).toBe(false)
    expect(isFaceTrackingEffect(undefined)).toBe(false)
  })

  it('normalizes animation frame times into the overlay loop', () => {
    expect(normalizeCameraEffectFrameMs(0)).toBe(0)
    expect(normalizeCameraEffectFrameMs(CAMERA_EFFECT_LOOP_MS + 120)).toBe(120)
    expect(normalizeCameraEffectFrameMs(-120)).toBe(CAMERA_EFFECT_LOOP_MS - 120)
    expect(normalizeCameraEffectFrameMs(4_620, 'windut')).toBe(120)
  })

  it('does not invent face-tracking bounds unless fallback is requested', () => {
    expect(resolveFaceTrackingEffectFaces([])).toEqual([])
    expect(resolveFaceTrackingEffectFaces([{ x: 0, y: 0, width: 0, height: 0 }])).toEqual([])
    expect(resolveFaceTrackingEffectFaces([], { width: 400, height: 300 })).toHaveLength(1)
  })

  it('maps Photo Booth sprite assets to the local overlay presets', () => {
    expect(getCameraEffectAssetManifest('hearts').map((asset) => asset.key)).toEqual([
      'heart-small',
      'heart-medium',
      'heart-large',
    ])

    expect(getCameraEffectAssetManifest('bluebirds').map((asset) => asset.key)).toEqual([
      'bird-small-0',
      'bird-small-1',
      'bird-small-2',
      'bird-small-3',
      'bird-medium-0',
      'bird-medium-1',
      'bird-medium-2',
      'bird-medium-3',
      'bird-large-0',
      'bird-large-1',
      'bird-large-2',
      'bird-large-3',
    ])

    const kicauManiaAssetKeys = getCameraEffectAssetManifest('kicau-mania').map(
      (asset) => asset.key,
    )

    expect(kicauManiaAssetKeys).toHaveLength(53)
    expect(kicauManiaAssetKeys.slice(0, 3)).toEqual([
      'kicau-mania-0',
      'kicau-mania-1',
      'kicau-mania-2',
    ])
    expect(kicauManiaAssetKeys[52]).toBe('kicau-mania-52')

    const windutAssetKeys = getCameraEffectAssetManifest('windut').map((asset) => asset.key)

    expect(windutAssetKeys).toHaveLength(45)
    expect(windutAssetKeys.slice(0, 3)).toEqual(['windut-0', 'windut-1', 'windut-2'])
    expect(windutAssetKeys[44]).toBe('windut-44')
  })
})
