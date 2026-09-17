export type BoothLocalBackgroundStatus = 'off' | 'loading' | 'ready' | 'error'

export function shouldConfirmGuestBackgroundReady(options: {
  role: 'host' | 'guest'
  processorStatus: BoothLocalBackgroundStatus
  backgroundId: string
  hasCustomImage: boolean
}): boolean {
  if (options.role !== 'guest') return false
  if (options.backgroundId === 'off') return false
  if (options.processorStatus !== 'ready') return false
  if (options.backgroundId === 'custom' && !options.hasCustomImage) return false
  return true
}

export function isBoothCaptureBackgroundReady(options: {
  backgroundId: string
  localStatus: BoothLocalBackgroundStatus | null | undefined
  friendJoined: boolean
  role: 'host' | 'guest'
  peerStatus: { status: string; revision: number } | null
  setupRevision: number
  guestStatus: string
}): boolean {
  if (options.backgroundId === 'off') return true
  if (options.localStatus !== 'ready') return false
  if (!options.friendJoined) return true
  if (options.role === 'host') {
    return (
      options.peerStatus?.status === 'ready' && options.peerStatus.revision === options.setupRevision
    )
  }
  return options.guestStatus === 'ready'
}

export function boothHostStartLabel(options: {
  friendJoined: boolean
  captureReady: boolean
  localReady: boolean
}): string {
  if (!options.friendJoined) return 'Menunggu teman'
  if (options.captureReady) return 'Mulai pose'
  if (options.localReady) return 'Teman memuat latar...'
  return 'Menyiapkan latar...'
}

export function boothHostPeerBackgroundLabel(
  status: 'loading' | 'ready' | 'error' | null | undefined,
): string {
  if (status === 'ready') return 'Teman siap'
  if (status === 'error') return 'Latar gagal'
  return 'Teman memuat latar...'
}
