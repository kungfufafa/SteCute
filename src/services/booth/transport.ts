export type BoothPeerRole = 'host' | 'guest'

export type BoothWireMessage =
  | { type: 'hello'; peerId: string; role: BoothPeerRole }
  | { type: 'welcome'; peerId: string; role: BoothPeerRole }
  | {
      type: 'start-moment'
      momentIndex: number
      countdownMs: number
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
    }

export type BoothTransport = {
  send(message: BoothWireMessage): void
  subscribe(handler: (message: BoothWireMessage) => void): () => void
  dispose?: () => void
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

function cloneMessage(message: BoothWireMessage): BoothWireMessage {
  if (message.type !== 'still') return { ...message }

  return {
    ...message,
    bytes: message.bytes.slice(0),
  }
}
