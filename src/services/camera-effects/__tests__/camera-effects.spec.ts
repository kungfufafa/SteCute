import { describe, expect, it } from 'vitest'
import {
  CAMERA_EFFECTS,
  getCameraEffectById,
  normalizeCameraEffectId,
  isFaceTrackingEffect,
  normalizeCameraEffectFrameMs,
  CAMERA_EFFECT_LOOP_MS,
  getCameraEffectAssetManifest,
} from '@/services/camera-effects'

describe('camera effects', () => {
  it('exposes local camera overlay presets', () => {
    expect(CAMERA_EFFECTS.map((effect) => effect.id)).toEqual(['none', 'hearts', 'bluebirds'])
  })

  it('falls back to no overlay for unknown ids', () => {
    expect(getCameraEffectById('missing').id).toBe('none')
    expect(normalizeCameraEffectId('missing')).toBe('none')
  })

  it('identifies face-tracking effects correctly', () => {
    expect(isFaceTrackingEffect('hearts')).toBe(true)
    expect(isFaceTrackingEffect('bluebirds')).toBe(true)
    expect(isFaceTrackingEffect('sparkles')).toBe(false)
    expect(isFaceTrackingEffect('none')).toBe(false)
    expect(isFaceTrackingEffect(null)).toBe(false)
    expect(isFaceTrackingEffect(undefined)).toBe(false)
  })

  it('normalizes animation frame times into the overlay loop', () => {
    expect(normalizeCameraEffectFrameMs(0)).toBe(0)
    expect(normalizeCameraEffectFrameMs(CAMERA_EFFECT_LOOP_MS + 120)).toBe(120)
    expect(normalizeCameraEffectFrameMs(-120)).toBe(CAMERA_EFFECT_LOOP_MS - 120)
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
  })
})
