export type BoothPeerRole = 'host' | 'guest'

export type BoothWireMessage =
  | { type: 'hello'; peerId: string; role: BoothPeerRole }
  | { type: 'welcome'; peerId: string; role: BoothPeerRole }
  | { type: 'bye'; peerId: string }
  | { type: 'reject'; peerId: string; toPeerId: string; reason: 'full' }
  | {
      type: 'session-setup'
      layoutId: string
      templateId: string
      slotCount: number
      countdownMs: number
      autoCapture?: boolean
      filterId: string
      cameraEffectId: string
      virtualBackgroundId?: string
      virtualBackgroundAssetId?: string | null
      revision?: number
      nonce?: string
    }
  | { type: 'session-reset'; nonce?: string }
  | {
      type: 'start-moment'
      momentIndex: number
      countdownMs: number
      revision?: number
      nonce?: string
    }
  | {
      type: 'cancel-moment'
      momentIndex?: number
      reason?: string
      nonce?: string
    }
  | {
      type: 'still'
      momentIndex: number
      peerId: string
      role: BoothPeerRole
      mimeType: string
      width: number
      height: number
      bytes: ArrayBuffer
      revision?: number
      faceBounds?: Array<{ x: number; y: number; width: number; height: number }>
      cameraEffectFrameMs?: number
    }
  | {
      type: 'background-asset'
      assetId: string
      revision: number
      hash: string
      mimeType: string
      bytes: ArrayBuffer
      peerId: string
    }
  | {
      type: 'background-asset-request'
      assetId: string
      revision: number
      fromPeerId: string
    }
  | {
      type: 'background-fallback-request'
      peerId: string
      revision: number
    }
  | {
      type: 'background-status'
      peerId: string
      revision: number
      assetId?: string | null
      status: 'loading' | 'ready' | 'error'
      errorReason?: string
    }

export type BoothMediaSession = {
  attachLocalStream(stream: MediaStream | null): void
  subscribeRemoteStream(handler: (stream: MediaStream | null) => void): () => void
}

export type BoothTransport = {
  send(message: BoothWireMessage): void
  subscribe(handler: (message: BoothWireMessage) => void): () => void
  dispose?: () => void
  media?: BoothMediaSession
}

export function createInProcessTransportPair(): {
  host: BoothTransport
  guest: BoothTransport
} {
  const hostHandlers = new Set<(message: BoothWireMessage) => void>()
  const guestHandlers = new Set<(message: BoothWireMessage) => void>()

  const host: BoothTransport = {
    send(message) {
      const cloned = cloneMessage(message)
      for (const handler of guestHandlers) handler(cloned)
    },
    subscribe(handler) {
      hostHandlers.add(handler)
      return () => hostHandlers.delete(handler)
    },
  }

  const guest: BoothTransport = {
    send(message) {
      const cloned = cloneMessage(message)
      for (const handler of hostHandlers) handler(cloned)
    },
    subscribe(handler) {
      guestHandlers.add(handler)
      return () => guestHandlers.delete(handler)
    },
  }

  return { host, guest }
}

export function createBroadcastBoothTransport(channelName: string): BoothTransport {
  const channel = new BroadcastChannel(channelName)

  return {
    send(message) {
      channel.postMessage(message)
    },
    subscribe(handler) {
      const listener = (event: MessageEvent<BoothWireMessage>) => {
        handler(event.data)
      }
      channel.addEventListener('message', listener)
      return () => channel.removeEventListener('message', listener)
    },
    dispose() {
      channel.close()
    },
  }
}

export function boothChannelName(normalizedCode: string): string {
  return `stecute.booth.${normalizedCode}`
}

export function createFanoutBoothTransport(): BoothTransport & {
  add(transport: BoothTransport): void
} {
  const transports: BoothTransport[] = []
  const handlers = new Set<(message: BoothWireMessage) => void>()
  const handlerUnsubscribers = new Map<(message: BoothWireMessage) => void, Array<() => void>>()
  const remoteHandlers = new Set<(stream: MediaStream | null) => void>()
  const mediaUnsubscribers: Array<() => void> = []
  let localStream: MediaStream | null = null
  let remoteStream: MediaStream | null = null

  function emitRemote(stream: MediaStream | null) {
    remoteStream = stream
    for (const handler of remoteHandlers) handler(stream)
  }

  const media: BoothMediaSession = {
    attachLocalStream(stream) {
      localStream = stream
      for (const transport of transports) transport.media?.attachLocalStream(stream)
    },
    subscribeRemoteStream(handler) {
      remoteHandlers.add(handler)
      if (remoteStream) handler(remoteStream)
      return () => remoteHandlers.delete(handler)
    },
  }

  return {
    media,
    add(transport) {
      transports.push(transport)
      if (localStream) transport.media?.attachLocalStream(localStream)
      if (transport.media) {
        mediaUnsubscribers.push(transport.media.subscribeRemoteStream(emitRemote))
      }
      for (const handler of handlers) {
        const unsubscribers = handlerUnsubscribers.get(handler) ?? []
        unsubscribers.push(transport.subscribe(handler))
        handlerUnsubscribers.set(handler, unsubscribers)
      }
    },
    send(message) {
      for (const transport of transports) transport.send(message)
    },
    subscribe(handler) {
      handlers.add(handler)
      const unsubscribers = transports.map((transport) => transport.subscribe(handler))
      handlerUnsubscribers.set(handler, unsubscribers)
      return () => {
        handlers.delete(handler)
        for (const unsubscribe of handlerUnsubscribers.get(handler) ?? []) unsubscribe()
        handlerUnsubscribers.delete(handler)
      }
    },
    dispose() {
      handlers.clear()
      handlerUnsubscribers.clear()
      remoteHandlers.clear()
      for (const unsubscribe of mediaUnsubscribers) unsubscribe()
      mediaUnsubscribers.length = 0
      localStream = null
      remoteStream = null
      for (const transport of transports) transport.dispose?.()
      transports.length = 0
    },
  }
}

function cloneMessage(message: BoothWireMessage): BoothWireMessage {
  if (message.type === 'still') {
    return {
      ...message,
      bytes: message.bytes.slice(0),
      faceBounds: message.faceBounds?.map((face) => ({ ...face })),
    }
  }

  if (message.type === 'background-asset') {
    return {
      ...message,
      bytes: message.bytes.slice(0),
    }
  }

  return { ...message }
}
