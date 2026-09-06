import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  consumePendingSessionConfig,
  writePendingSessionConfig,
} from '@/services/session/persist'

const memory = new Map<string, string>()

function installSessionStorage() {
  const storage = {
    getItem(key: string) {
      return memory.get(key) ?? null
    },
    setItem(key: string, value: string) {
      memory.set(key, value)
    },
    removeItem(key: string) {
      memory.delete(key)
    },
    clear() {
      memory.clear()
    },
    key() {
      return null
    },
    get length() {
      return memory.size
    },
  }

  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: storage,
  })
}

describe('pending session config', () => {
  beforeEach(() => {
    memory.clear()
    installSessionStorage()
  })

  afterEach(() => {
    memory.clear()
  })

  it('keeps an upload layout until the upload page consumes it', () => {
    writePendingSessionConfig({
      layoutId: 'strip-6-vertical',
      templateId: 'youth',
      slotCount: 6,
      countdownSeconds: 5,
      autoCapture: true,
      source: 'upload',
    })

    expect(consumePendingSessionConfig('camera')).toBeNull()
    expect(consumePendingSessionConfig('upload')).toMatchObject({
      layoutId: 'strip-6-vertical',
      templateId: 'youth',
      slotCount: 6,
      source: 'upload',
    })
    expect(consumePendingSessionConfig('upload')).toBeNull()
  })

  it('lets the camera page consume a camera config without touching upload later', () => {
    writePendingSessionConfig({
      layoutId: 'strip-2-vertical',
      templateId: 'classic',
      slotCount: 2,
      countdownSeconds: 3,
      autoCapture: false,
      source: 'camera',
    })

    expect(consumePendingSessionConfig('upload')).toBeNull()
    expect(consumePendingSessionConfig('camera')?.layoutId).toBe('strip-2-vertical')
    expect(consumePendingSessionConfig('camera')).toBeNull()
  })
})
