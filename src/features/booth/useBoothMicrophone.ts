import { computed, ref } from 'vue'
import { initMicrophone } from '@/services/camera'

export function useBoothMicrophone(options: {
  setOutboundEnabled: (enabled: boolean) => void
  onStreamChanged: () => void
}) {
  const muted = ref(false)
  const available = ref(false)
  const busy = ref(false)
  const notice = ref('')
  const enabled = computed(() => available.value && !muted.value)
  let source: MediaStream | null = null
  let generation = 0
  let disposed = false
  let removeListeners: Array<() => void> = []

  function syncTracks() {
    const tracks = source?.getAudioTracks().filter((track) => track.readyState === 'live') ?? []
    available.value = tracks.length > 0
    for (const track of tracks) track.enabled = !muted.value
    options.setOutboundEnabled(enabled.value)
  }

  function watchTracks() {
    for (const remove of removeListeners) remove()
    removeListeners = []
    for (const track of source?.getAudioTracks() ?? []) {
      const onEnded = () => {
        if (disposed) return
        syncTracks()
        if (!available.value) notice.value = 'Mikrofon terputus. Nyalakan lagi untuk berbicara.'
      }
      track.addEventListener('ended', onEnded)
      removeListeners.push(() => track.removeEventListener('ended', onEnded))
    }
  }

  function bindStream(next: MediaStream | null) {
    generation += 1
    source = next
    busy.value = false
    notice.value = ''
    watchTracks()
    syncTracks()
  }

  async function toggle() {
    if (disposed || busy.value || !source) return
    syncTracks()
    if (available.value) {
      muted.value = !muted.value
      notice.value = ''
      syncTracks()
      return
    }
    if (!source.getVideoTracks().some((track) => track.readyState === 'live')) return

    const target = source
    const request = ++generation
    busy.value = true
    notice.value = ''
    try {
      const acquired = await initMicrophone()
      if (disposed || request !== generation || source !== target) {
        acquired.getTracks().forEach((track) => track.stop())
        return
      }
      const audioTracks = acquired.getAudioTracks().filter((track) => track.readyState === 'live')
      // Only audio is adopted; the camera remains owned by the room.
      acquired
        .getTracks()
        .filter((track) => !audioTracks.includes(track))
        .forEach((track) => track.stop())
      if (!audioTracks.length) throw new Error('Microphone unavailable')
      for (const track of target.getAudioTracks()) {
        target.removeTrack(track)
        track.stop()
      }
      for (const track of audioTracks) target.addTrack(track)
      muted.value = false
      watchTracks()
      syncTracks()
      options.onStreamChanged()
    } catch (error) {
      if (disposed || request !== generation || source !== target) return
      notice.value =
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'Izinkan mikrofon di pengaturan situs browser, lalu coba nyalakan lagi. Foto tetap bisa diambil.'
          : 'Mikrofon belum tersedia. Periksa perangkat, lalu coba lagi. Foto tetap bisa diambil.'
      syncTracks()
    } finally {
      if (!disposed && request === generation) busy.value = false
    }
  }

  function dispose() {
    disposed = true
    generation += 1
    for (const remove of removeListeners) remove()
    removeListeners = []
    source = null
    available.value = false
    options.setOutboundEnabled(false)
  }

  return { enabled, available, busy, notice, bindStream, toggle, dispose }
}
