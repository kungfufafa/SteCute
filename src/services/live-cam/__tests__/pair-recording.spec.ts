import { describe, expect, it } from 'vitest'
import { isLiveStripRenderingSupported, startPairLiveCamRecording } from '@/services/live-cam'

describe('booth pair live cam', () => {
  it('does not start a pair recording without a live camera frame', () => {
    const video = {
      videoWidth: 0,
      videoHeight: 0,
      readyState: 0,
    } as HTMLVideoElement

    expect(startPairLiveCamRecording({
      localVideo: video,
      remoteVideo: null,
      width: 1080,
      height: 810,
      localOnLeft: true,
    })).toBeNull()
  })

  it('reports live-strip support from the real environment APIs', () => {
    expect(typeof isLiveStripRenderingSupported()).toBe('boolean')
  })
})
