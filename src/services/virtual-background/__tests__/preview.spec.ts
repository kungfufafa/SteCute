import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { sizeCanvasToSource } from '@/services/camera/cover-crop'
import {
  configureActiveBackgroundStatus,
  shouldNotifyBackgroundStatus,
} from '@/services/virtual-background/processor'

function readSource(relativePath: string) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

describe('virtual background preview presentation', () => {
  it('keeps the preview bitmap at the processed 4:3 size so CSS object-cover does not stretch people', () => {
    const canvas = { width: 300, height: 150 }
    sizeCanvasToSource(canvas, { width: 720, height: 540 })

    expect(canvas.width).toBe(720)
    expect(canvas.height).toBe(540)
    expect(canvas.width / canvas.height).toBeCloseTo(4 / 3)
  })

  it('keeps the WebRTC preview bitmap camera-native so the friend tile can CSS-mirror like Asli', () => {
    const processor = readSource('../processor.ts')
    const previewStart = processor.indexOf('private async processPreviewFrame')
    const captureStart = processor.indexOf('public async captureStill')
    expect(previewStart).toBeGreaterThan(-1)
    expect(captureStart).toBeGreaterThan(-1)

    const previewFn = processor.slice(previewStart)
    const captureFn = processor.slice(captureStart, previewStart)
    expect(previewFn).not.toContain('this.mirrored')
    expect(captureFn).toContain('options.mirrored ?? this.mirrored')
    expect(captureFn).toContain('stillCtx.scale(-1, 1)')
  })

  it('CSS-mirrors the local virtual-background canvas instead of baking selfie flip into the outbound stream', () => {
    const canvas = readSource('../../../components/common/VirtualBackgroundCanvas.vue')
    expect(canvas).toContain("mirrored ? 'scale-x-[-1]' : ''")
  })
})

describe('virtual background configure status', () => {
  it('stays ready when switching studio backgrounds after segmentation is already live', () => {
    expect(
      configureActiveBackgroundStatus({
        active: true,
        alreadyReady: true,
      }),
    ).toBe('ready')
  })

  it('shows loading only while the segmenter is still starting', () => {
    expect(
      configureActiveBackgroundStatus({
        active: true,
        alreadyReady: false,
      }),
    ).toBe('loading')
  })

  it('turns off when the background is disabled', () => {
    expect(
      configureActiveBackgroundStatus({
        active: false,
        alreadyReady: true,
      }),
    ).toBe('off')
  })

  it('re-notifies ready after a studio switch so booth guests can confirm the new revision', () => {
    expect(
      shouldNotifyBackgroundStatus({
        current: 'ready',
        next: 'ready',
        errorChanged: false,
      }),
    ).toBe(false)
    expect(
      shouldNotifyBackgroundStatus({
        current: 'ready',
        next: 'ready',
        errorChanged: false,
        force: true,
      }),
    ).toBe(true)
  })
})
