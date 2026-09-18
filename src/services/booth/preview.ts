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

export function pickLiveAudioTrack(
  source: MediaStream | null | undefined,
): MediaStreamTrack | null {
  return source?.getAudioTracks().find((track) => track.readyState === 'live') ?? null
}

export function collectBoothMediaTracks(
  videoSource: MediaStream | null | undefined,
  audioSource: MediaStream | null | undefined = videoSource,
): MediaStreamTrack[] {
  const tracks: MediaStreamTrack[] = []
  const video = pickLiveVideoTrack(videoSource)
  const audio = pickLiveAudioTrack(audioSource)
  if (video) tracks.push(video)
  if (audio) tracks.push(audio)
  return tracks
}

export function composeBoothMediaStream(
  videoSource: MediaStream | null | undefined,
  audioSource: MediaStream | null | undefined = videoSource,
): MediaStream | null {
  const tracks = collectBoothMediaTracks(videoSource, audioSource)
  if (!tracks.length) return null
  return new MediaStream(tracks)
}
