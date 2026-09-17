import { describe, expect, it } from 'vitest'
import { sizeCanvasToSource } from '@/services/camera/cover-crop'
import {
  configureActiveBackgroundStatus,
  shouldNotifyBackgroundStatus,
} from '@/services/virtual-background/processor'

describe('virtual background preview presentation', () => {
  it('keeps the preview bitmap at the processed 4:3 size so CSS object-cover does not stretch people', () => {
    const canvas = { width: 300, height: 150 }
    sizeCanvasToSource(canvas, { width: 720, height: 540 })

    expect(canvas.width).toBe(720)
    expect(canvas.height).toBe(540)
    expect(canvas.width / canvas.height).toBeCloseTo(4 / 3)
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
