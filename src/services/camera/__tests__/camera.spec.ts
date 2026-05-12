import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useCameraStore } from '@/app/store/useCameraStore'
import {
  initCamera,
  inferCameraFacingMode,
  inferCameraLens,
  normalizeCameraDevices,
  shouldMirrorCamera,
} from '@/services/camera'

const originalNavigator = globalThis.navigator

function videoInput(deviceId: string, label: string) {
  return {
    deviceId,
    groupId: `group-${deviceId}`,
    label,
  } as MediaDeviceInfo
}

function mockMediaDevices({
  deviceId,
  facingMode,
  label = '',
}: {
  deviceId?: string
  facingMode?: string
  label?: string
}) {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      mediaDevices: {
        getUserMedia: vi.fn(async () => ({
          getVideoTracks: () => [
            {
              label,
              getSettings: () => ({
                deviceId,
                facingMode,
              }),
            },
          ],
        })),
        enumerateDevices: vi.fn(async () => [videoInput(deviceId ?? 'camera-1', label)]),
      },
    },
  })
}

describe('camera device normalization', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: originalNavigator,
    })
  })

  it('classifies common mobile front, rear, ultrawide, and telephoto labels', () => {
    const devices = normalizeCameraDevices([
      videoInput('ultrawide', 'Back Ultra Wide Camera'),
      videoInput('front', 'Front Camera'),
      videoInput('wide', 'Back Camera'),
      videoInput('tele', 'Back Telephoto Camera'),
    ])

    expect(devices.map((device) => device.deviceId)).toEqual(['front', 'wide', 'ultrawide', 'tele'])
    expect(devices.map((device) => device.label)).toEqual([
      'Depan',
      'Belakang',
      'Belakang 0.5x',
      'Belakang Tele',
    ])
  })

  it('uses facing and lens labels to decide mirroring', () => {
    expect(inferCameraFacingMode('Front Camera')).toBe('user')
    expect(inferCameraFacingMode('Back 0.5x Camera')).toBe('environment')
    expect(inferCameraLens('Back 0.5x Camera', 'environment')).toBe('ultrawide')
    expect(inferCameraLens('Back Telephoto Camera', 'environment')).toBe('telephoto')
    expect(shouldMirrorCamera('user')).toBe(true)
    expect(shouldMirrorCamera('environment')).toBe(false)
    expect(shouldMirrorCamera('unknown')).toBe(false)
  })

  it('falls back to the requested default front camera when stream metadata is missing', async () => {
    mockMediaDevices({ deviceId: 'front-camera' })

    await initCamera()

    expect(useCameraStore().activeFacingMode).toBe('user')
  })

  it('does not treat a selected device with missing metadata as the default front camera', async () => {
    mockMediaDevices({ deviceId: 'selected-camera' })

    await initCamera({ deviceId: 'selected-camera' })

    expect(useCameraStore().activeFacingMode).toBe('unknown')
  })
})
