export type BoothPeerRole = 'host' | 'guest'

export type BoothWireMessage =
  | { type: 'hello'; peerId: string; role: BoothPeerRole }
  | { type: 'welcome'; peerId: string; role: BoothPeerRole }
  | { type: 'bye'; peerId: string }
  | { type: 'reject'; peerId: string; toPeerId: string; reason: 'full' }
  | {
      type: 'start-moment'
      momentIndex: number
      countdownMs: number
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

export function createFanoutBoothTransport(): BoothTransport & {
  add(transport: BoothTransport): void
} {
  const transports: BoothTransport[] = []
  const handlers = new Set<(message: BoothWireMessage) => void>()
  const handlerUnsubscribers = new Map<(message: BoothWireMessage) => void, Array<() => void>>()

  return {
    add(transport) {
      transports.push(transport)
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
      for (const transport of transports) transport.dispose?.()
      transports.length = 0
    },
  }
}

function cloneMessage(message: BoothWireMessage): BoothWireMessage {
  if (message.type !== 'still') return { ...message }

  return {
    ...message,
    bytes: message.bytes.slice(0),
  }
}
