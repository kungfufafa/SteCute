import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  consumePendingSessionConfig,
  persistActiveSessionId,
  readPendingBoothSetup,
  readPendingSessionConfig,
  writePendingBoothSetup,
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

  it('lets upload and camera reread pending config without consuming it', () => {
    writePendingSessionConfig({
      layoutId: 'strip-4-vertical',
      templateId: 'mono',
      slotCount: 4,
      countdownSeconds: 3,
      autoCapture: false,
      source: 'upload',
    })

    expect(readPendingSessionConfig('camera')).toBeNull()
    expect(readPendingSessionConfig('upload')?.layoutId).toBe('strip-4-vertical')
    expect(readPendingSessionConfig('upload')?.slotCount).toBe(4)
    expect(consumePendingSessionConfig('upload')?.templateId).toBe('mono')
    expect(readPendingSessionConfig('upload')).toBeNull()
  })

  it('keeps pending config when the active session id is cleared', () => {
    writePendingSessionConfig({
      layoutId: 'strip-6-vertical',
      templateId: 'youth',
      slotCount: 6,
      countdownSeconds: 5,
      autoCapture: true,
      source: 'upload',
    })
    persistActiveSessionId('session-1')
    persistActiveSessionId(null)

    expect(readPendingSessionConfig('upload')?.layoutId).toBe('strip-6-vertical')
  })
})

describe('pending booth setup', () => {
  beforeEach(() => {
    memory.clear()
    installSessionStorage()
  })

  afterEach(() => {
    memory.clear()
  })

  it('keeps booth setup separate from camera and upload pending config', () => {
    writePendingSessionConfig({
      layoutId: 'strip-2-vertical',
      templateId: 'classic',
      slotCount: 2,
      countdownSeconds: 3,
      autoCapture: false,
      source: 'camera',
    })
    writePendingBoothSetup({
      code: 'ABC-DEF',
      layoutId: 'strip-4-vertical',
      templateId: 'youth',
      slotCount: 4,
      countdownSeconds: 5,
      autoCapture: true,
    })

    expect(readPendingSessionConfig('camera')?.layoutId).toBe('strip-2-vertical')
    expect(readPendingBoothSetup()?.layoutId).toBe('strip-4-vertical')
    expect(readPendingBoothSetup('ABCDEF')?.autoCapture).toBe(true)
    expect(readPendingBoothSetup('ZZZ-ZZZ')).toBeNull()
  })

  it('rereads booth setup without consuming it', () => {
    writePendingBoothSetup({
      code: 'VMB-AX5',
      layoutId: 'strip-6-vertical',
      templateId: 'mono',
      slotCount: 6,
      countdownSeconds: 10,
      autoCapture: false,
      filterId: 'warm',
    })

    expect(readPendingBoothSetup('VMBAX5')?.templateId).toBe('mono')
    expect(readPendingBoothSetup()?.filterId).toBe('warm')
    expect(readPendingBoothSetup('vmbax5')?.countdownSeconds).toBe(10)
  })
})
