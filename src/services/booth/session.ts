import { composePairRow, type BoothStill, type ComposedPairShot } from './compose'
import type { BoothPeerRole, BoothTransport, BoothWireMessage } from './transport'

export type { BoothPeerRole, BoothStill, ComposedPairShot }

export type BoothStartEvent = {
  momentIndex: number
  countdownMs: number
}

export type BoothPeerSession = {
  peerId: string
  role: BoothPeerRole
  startMoment(momentIndex: number, countdownMs?: number): void
  submitStill(momentIndex: number, still: BoothStill): Promise<void>
  waitForComposed(momentIndex: number, timeoutMs?: number): Promise<ComposedPairShot>
  waitForCountdown(momentIndex: number): Promise<number>
  waitForStart(): Promise<BoothStartEvent>
  getComposedShots(): ComposedPairShot[]
  getRemotePeerId(): string | null
  getRejectedReason(): 'full' | null
  announce(): void
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
  const countdownWaiters = new Map<
    number,
    Array<{
      resolve: (countdownMs: number) => void
      reject: (error: unknown) => void
    }>
  >()
  const startQueue: BoothStartEvent[] = []
  const startWaiters: Array<{
    resolve: (event: BoothStartEvent) => void
    reject: (error: unknown) => void
  }> = []
  const startedMoments = new Map<number, number>()
  const composeJobs = new Map<number, Promise<void>>()
  const recentMessageAt = new Map<string, number>()
  let startNonce = 0
  let remotePeerId: string | null = null
  let remoteRole: BoothPeerRole | null = null
  let lastRemoteAt = 0
  let rejectedReason: 'full' | null = null
  let disposed = false
  const REMOTE_TIMEOUT_MS = 12_000

  const unsubscribe = options.transport.subscribe((message) => {
    void handleMessage(message).catch((error) => {
      if (message.type === 'still') rejectComposed(message.momentIndex, error)
    })
  })

  options.transport.send({ type: 'hello', peerId: options.peerId, role: options.role })

  async function handleMessage(message: BoothWireMessage) {
    if (message.type === 'reject') {
      if (message.toPeerId !== options.peerId) return
      rejectedReason = message.reason
      return
    }

    if (rejectedReason) return

    if (message.type === 'bye') {
      if (message.peerId === remotePeerId) {
        remotePeerId = null
        remoteRole = null
        lastRemoteAt = 0
      }
      return
    }

    if (message.type === 'hello' || message.type === 'welcome') {
      if (message.peerId === options.peerId) return
      if (options.role === 'guest' && message.role === 'guest') return
      if (remotePeerId && remotePeerId !== message.peerId) {
        if (options.role === 'host' && message.type === 'hello') {
          options.transport.send({
            type: 'reject',
            peerId: options.peerId,
            toPeerId: message.peerId,
            reason: 'full',
          })
        }
        return
      }
      const isNewRemote = remotePeerId !== message.peerId
      remotePeerId = message.peerId
      remoteRole = message.role === 'host' || message.role === 'guest' ? message.role : remoteRole
      lastRemoteAt = Date.now()
      if (message.type === 'hello') {
        options.transport.send({ type: 'welcome', peerId: options.peerId, role: options.role })
        if (isNewRemote) replayStartedMoments()
      }
      return
    }

    if (message.type === 'start-moment') {
      const duplicateKey = message.nonce
        ? `start:${message.nonce}`
        : `start:${message.momentIndex}:${message.countdownMs}`
      if (isDuplicate(duplicateKey, message.nonce ? 10_000 : 400)) return
      lastRemoteAt = Date.now()
      emitStart(message.momentIndex, message.countdownMs)
      return
    }

    if (message.type === 'still') {
      if (message.peerId === remotePeerId) lastRemoteAt = Date.now()
      if (remotePeerId && message.peerId !== remotePeerId && message.peerId !== options.peerId) {
        return
      }

      const stillRole = resolveStillRole(message.peerId)
      if (!stillRole) return

      const still: BoothStill = {
        blob: new Blob([message.bytes], { type: message.mimeType || 'image/png' }),
        width: message.width,
        height: message.height,
      }
      storeStill(stillRole, message.momentIndex, still)
      await maybeCompose(message.momentIndex)
    }
  }

  function resolveStillRole(peerId: string): BoothPeerRole | null {
    if (peerId === options.peerId) return options.role
    if (peerId === remotePeerId) {
      if (remoteRole === 'host' || remoteRole === 'guest') return remoteRole
      return options.role === 'host' ? 'guest' : 'host'
    }
    return null
  }

  function storeStill(role: BoothPeerRole, momentIndex: number, still: BoothStill) {
    const bucket = role === 'host' ? hostStills : guestStills
    bucket.set(momentIndex, still)
  }

  function replayStartedMoments() {
    for (const [momentIndex, countdownMs] of startedMoments.entries()) {
      if (composed.has(momentIndex)) continue
      options.transport.send({
        type: 'start-moment',
        momentIndex,
        countdownMs,
        nonce: nextStartNonce(),
      })
    }
  }

  function nextStartNonce() {
    startNonce += 1
    return `${options.peerId}:${startNonce}`
  }

  function isDuplicate(key: string, windowMs: number) {
    const now = Date.now()
    const last = recentMessageAt.get(key)
    if (last != null && now - last < windowMs) return true
    recentMessageAt.set(key, now)
    if (recentMessageAt.size > 80) {
      for (const [entry, seenAt] of recentMessageAt) {
        if (now - seenAt > 15_000) recentMessageAt.delete(entry)
      }
    }
    return false
  }

  function emitStart(momentIndex: number, countdownMs: number) {
    startedMoments.set(momentIndex, countdownMs)
    const waiters = countdownWaiters.get(momentIndex) ?? []
    countdownWaiters.delete(momentIndex)
    for (const waiter of waiters) waiter.resolve(countdownMs)

    const event = { momentIndex, countdownMs }
    const startWaiter = startWaiters.shift()
    if (startWaiter) startWaiter.resolve(event)
    else startQueue.push(event)
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

      const nonce = nextStartNonce()
      options.transport.send({ type: 'start-moment', momentIndex, countdownMs, nonce })
      emitStart(momentIndex, countdownMs)
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
    waitForComposed(momentIndex, timeoutMs = 30_000) {
      if (disposed) return Promise.reject(new Error('Booth session disposed'))
      const existing = composed.get(momentIndex)
      if (existing) return Promise.resolve(existing)

      return new Promise((resolve, reject) => {
        const waiter = {
          resolve: (shot: ComposedPairShot) => {
            globalThis.clearTimeout(timer)
            resolve(shot)
          },
          reject: (error: unknown) => {
            globalThis.clearTimeout(timer)
            reject(error)
          },
        }
        const timer = globalThis.setTimeout(() => {
          const pending = composedWaiters.get(momentIndex) ?? []
          composedWaiters.set(
            momentIndex,
            pending.filter((item) => item !== waiter),
          )
          reject(new Error('Booth compose timed out'))
        }, timeoutMs)
        const waiters = composedWaiters.get(momentIndex) ?? []
        waiters.push(waiter)
        composedWaiters.set(momentIndex, waiters)
      })
    },
    waitForCountdown(momentIndex) {
      if (disposed) return Promise.reject(new Error('Booth session disposed'))
      const existing = startedMoments.get(momentIndex)
      if (existing != null) return Promise.resolve(existing)

      return new Promise((resolve, reject) => {
        const waiters = countdownWaiters.get(momentIndex) ?? []
        waiters.push({ resolve, reject })
        countdownWaiters.set(momentIndex, waiters)
      })
    },
    waitForStart() {
      if (disposed) return Promise.reject(new Error('Booth session disposed'))
      const queued = startQueue.shift()
      if (queued) return Promise.resolve(queued)

      return new Promise((resolve, reject) => {
        startWaiters.push({ resolve, reject })
      })
    },
    getComposedShots() {
      return [...composed.entries()]
        .sort((left, right) => left[0] - right[0])
        .map(([, shot]) => shot)
    },
    getRemotePeerId() {
      if (remotePeerId && lastRemoteAt > 0 && Date.now() - lastRemoteAt > REMOTE_TIMEOUT_MS) {
        remotePeerId = null
        remoteRole = null
      }
      return remotePeerId
    },
    getRejectedReason() {
      return rejectedReason
    },
    announce() {
      if (disposed) return
      options.transport.send({ type: 'hello', peerId: options.peerId, role: options.role })
    },
    dispose() {
      if (!disposed) {
        options.transport.send({ type: 'bye', peerId: options.peerId })
      }
      disposed = true
      unsubscribe()
      options.transport.dispose?.()
      const pending = [...composedWaiters.entries()]
      const pendingCountdowns = [...countdownWaiters.values()].flat()
      const pendingStarts = [...startWaiters]
      composedWaiters.clear()
      countdownWaiters.clear()
      startWaiters.length = 0
      startQueue.length = 0
      const disposedError = new Error('Booth session disposed')
      for (const [, waiters] of pending) {
        for (const waiter of waiters) waiter.reject(disposedError)
      }
      for (const waiter of pendingCountdowns) waiter.reject(disposedError)
      for (const waiter of pendingStarts) waiter.reject(disposedError)
    },
  }

  return session
}

export function createPeerId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `peer-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
}
