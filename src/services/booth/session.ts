import { composePairRow, type BoothStill, type ComposedPairShot } from './compose'
import type { BoothPeerRole, BoothTransport, BoothWireMessage } from './transport'

export type { BoothPeerRole, BoothStill, ComposedPairShot }

export type BoothPeerSession = {
  peerId: string
  role: BoothPeerRole
  startMoment(momentIndex: number, countdownMs?: number): void
  submitStill(momentIndex: number, still: BoothStill): Promise<void>
  waitForComposed(momentIndex: number): Promise<ComposedPairShot>
  waitForCountdown(momentIndex: number): Promise<number>
  getComposedShots(): ComposedPairShot[]
  getRemotePeerId(): string | null
  dispose(): void
}

export function createBoothPeerSession(options: {
  peerId: string
  role: BoothPeerRole
  transport: BoothTransport
  slot?: { width: number; height: number }
}): BoothPeerSession {
  const hostStills = new Map<number, BoothStill>()
  const guestStills = new Map<number, BoothStill>()
  const composed = new Map<number, ComposedPairShot>()
  const composedWaiters = new Map<
    number,
    Array<{
      resolve: (shot: ComposedPairShot) => void
      reject: (error: unknown) => void
    }>
  >()
  const countdownWaiters = new Map<number, Array<(countdownMs: number) => void>>()
  const startedMoments = new Map<number, number>()
  const composeJobs = new Map<number, Promise<void>>()
  let remotePeerId: string | null = null
  let disposed = false

  const unsubscribe = options.transport.subscribe((message) => {
    void handleMessage(message).catch((error) => {
      if (message.type === 'still') rejectComposed(message.momentIndex, error)
    })
  })

  options.transport.send({ type: 'hello', peerId: options.peerId, role: options.role })

  async function handleMessage(message: BoothWireMessage) {
    if (message.type === 'hello' || message.type === 'welcome') {
      if (message.peerId === options.peerId) return
      remotePeerId = message.peerId
      if (message.type === 'hello') {
        options.transport.send({ type: 'welcome', peerId: options.peerId, role: options.role })
      }
      return
    }

    if (message.type === 'start-moment') {
      resolveCountdown(message.momentIndex, message.countdownMs)
      return
    }

    if (message.type === 'still') {
      const still: BoothStill = {
        blob: new Blob([message.bytes], { type: message.mimeType || 'image/png' }),
        width: message.width,
        height: message.height,
      }
      storeStill(message.role, message.momentIndex, still)
      await maybeCompose(message.momentIndex)
    }
  }

  function storeStill(role: BoothPeerRole, momentIndex: number, still: BoothStill) {
    const bucket = role === 'host' ? hostStills : guestStills
    bucket.set(momentIndex, still)
  }

  function resolveCountdown(momentIndex: number, countdownMs: number) {
    startedMoments.set(momentIndex, countdownMs)
    const waiters = countdownWaiters.get(momentIndex) ?? []
    countdownWaiters.delete(momentIndex)
    for (const waiter of waiters) waiter(countdownMs)
  }

  function resolveComposed(momentIndex: number, shot: ComposedPairShot) {
    composed.set(momentIndex, shot)
    const waiters = composedWaiters.get(momentIndex) ?? []
    composedWaiters.delete(momentIndex)
    for (const waiter of waiters) waiter.resolve(shot)
  }

  function rejectComposed(momentIndex: number, error: unknown) {
    const waiters = composedWaiters.get(momentIndex) ?? []
    composedWaiters.delete(momentIndex)
    for (const waiter of waiters) waiter.reject(error)
  }

  async function maybeCompose(momentIndex: number) {
    const inFlight = composeJobs.get(momentIndex)
    if (inFlight) {
      await inFlight
      return
    }

    if (disposed || composed.has(momentIndex)) return

    const hostStill = hostStills.get(momentIndex)
    const guestStill = guestStills.get(momentIndex)
    if (!hostStill || !guestStill) return

    const job = (async () => {
      try {
        const shot = await composePairRow(hostStill, guestStill, options.slot)
        if (disposed) return
        resolveComposed(momentIndex, shot)
      } catch (error) {
        rejectComposed(momentIndex, error)
        throw error
      }
    })()

    composeJobs.set(momentIndex, job)
    try {
      await job
    } finally {
      composeJobs.delete(momentIndex)
    }
  }

  const session: BoothPeerSession = {
    peerId: options.peerId,
    role: options.role,
    startMoment(momentIndex, countdownMs = 3000) {
      if (disposed) {
        throw new Error('Booth session disposed')
      }
      if (options.role !== 'host') {
        throw new Error('Only the booth host can start a shared countdown.')
      }

      options.transport.send({ type: 'start-moment', momentIndex, countdownMs })
      resolveCountdown(momentIndex, countdownMs)
    },
    async submitStill(momentIndex, still) {
      if (disposed) {
        throw new Error('Booth session disposed')
      }
      storeStill(options.role, momentIndex, still)
      const bytes = await still.blob.arrayBuffer()
      options.transport.send({
        type: 'still',
        momentIndex,
        peerId: options.peerId,
        role: options.role,
        mimeType: still.blob.type || 'image/png',
        width: still.width,
        height: still.height,
        bytes,
      })
      await maybeCompose(momentIndex)
    },
    waitForComposed(momentIndex) {
      if (disposed) return Promise.reject(new Error('Booth session disposed'))
      const existing = composed.get(momentIndex)
      if (existing) return Promise.resolve(existing)

      return new Promise((resolve, reject) => {
        const waiters = composedWaiters.get(momentIndex) ?? []
        waiters.push({ resolve, reject })
        composedWaiters.set(momentIndex, waiters)
      })
    },
    waitForCountdown(momentIndex) {
      const existing = startedMoments.get(momentIndex)
      if (existing != null) return Promise.resolve(existing)

      return new Promise((resolve) => {
        const waiters = countdownWaiters.get(momentIndex) ?? []
        waiters.push(resolve)
        countdownWaiters.set(momentIndex, waiters)
      })
    },
    getComposedShots() {
      return [...composed.entries()]
        .sort((left, right) => left[0] - right[0])
        .map(([, shot]) => shot)
    },
    getRemotePeerId() {
      return remotePeerId
    },
    dispose() {
      disposed = true
      unsubscribe()
      options.transport.dispose?.()
      const pending = [...composedWaiters.entries()]
      composedWaiters.clear()
      countdownWaiters.clear()
      for (const [, waiters] of pending) {
        for (const waiter of waiters) waiter.reject(new Error('Booth session disposed'))
      }
    },
  }

  return session
}

export function createPeerId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `peer-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
}
