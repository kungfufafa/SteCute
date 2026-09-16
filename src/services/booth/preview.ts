export function isRemotePreviewReady(video: {
  srcObject: unknown
  videoWidth: number
  videoHeight: number
}): boolean {
  return Boolean(video.srcObject) && video.videoWidth > 0 && video.videoHeight > 0
}

export function pickLiveVideoTrack(
  source: MediaStream | null | undefined,
): MediaStreamTrack | null {
  return source?.getVideoTracks().find((track) => track.readyState === 'live') ?? null
}
