import { composePairRow, type BoothStill, type ComposedPairShot } from './compose'
import { normalizeBoothSetup, pairSlotForLayout, type BoothSessionSetup } from './setup'
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
  waitForSetup(): Promise<BoothSessionSetup>
  waitForReset(): Promise<void>
  setSetup(setup: BoothSessionSetup): void
  resetCapture(): void
  getSetup(): BoothSessionSetup | null
  getComposedShots(): ComposedPairShot[]
  getComposedByOrder(): Array<{ order: number; shot: ComposedPairShot }>
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
  setup?: BoothSessionSetup
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
  const setupQueue: BoothSessionSetup[] = []
  const setupWaiters: Array<{
    resolve: (setup: BoothSessionSetup) => void
    reject: (error: unknown) => void
  }> = []
  let resetQueued = 0
  const resetWaiters: Array<{
    resolve: () => void
    reject: (error: unknown) => void
  }> = []
  const startedMoments = new Map<number, number>()
  const startedNonces = new Map<number, string>()
  const composeJobs = new Map<number, Promise<void>>()
  const composeGeneration = new Map<number, number>()
  const recentMessageAt = new Map<string, number>()
  let startNonce = 0
  let setupNonce = 0
  const slotLocked = Boolean(options.slot)
  let pairSlot = options.slot ? { ...options.slot } : undefined
  let sessionSetup: BoothSessionSetup | null = options.setup
    ? normalizeBoothSetup(options.setup)
    : null
  if (sessionSetup && !pairSlot) pairSlot = pairSlotForLayout(sessionSetup.layoutId)
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
        if (isNewRemote) {
          replaySetup()
          replayStartedMoments()
        }
      }
      return
    }

    if (message.type === 'session-setup') {
      const duplicateKey = message.nonce
        ? `setup:${message.nonce}`
        : `setup:${message.layoutId}:${message.templateId}:${message.slotCount}:${message.countdownMs}:${message.filterId}:${message.cameraEffectId}`
      if (isDuplicate(duplicateKey, message.nonce ? 10_000 : 400)) return
      lastRemoteAt = Date.now()
      applySetup({
        layoutId: message.layoutId,
        templateId: message.templateId,
        slotCount: message.slotCount,
        countdownMs: message.countdownMs,
        filterId: message.filterId,
        cameraEffectId: message.cameraEffectId,
      })
      return
    }

    if (message.type === 'session-reset') {
      const duplicateKey = message.nonce ? `reset:${message.nonce}` : 'reset'
      if (isDuplicate(duplicateKey, message.nonce ? 10_000 : 400)) return
      lastRemoteAt = Date.now()
      clearAllMoments()
      emitReset()
      return
    }

    if (message.type === 'start-moment') {
      const duplicateKey = message.nonce
        ? `start:${message.nonce}`
        : `start:${message.momentIndex}:${message.countdownMs}`
      if (isDuplicate(duplicateKey, message.nonce ? 10_000 : 400)) return
      lastRemoteAt = Date.now()
      emitStart(message.momentIndex, message.countdownMs, { nonce: message.nonce })
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
        faceBounds: message.faceBounds?.map((face) => ({ ...face })),
        cameraEffectFrameMs: message.cameraEffectFrameMs,
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
        nonce: startedNonces.get(momentIndex) ?? nextStartNonce(),
      })
    }
  }

  function replaySetup() {
    if (!sessionSetup || options.role !== 'host') return
    options.transport.send({
      type: 'session-setup',
      ...sessionSetup,
      nonce: nextSetupNonce(),
    })
  }

  function nextStartNonce() {
    startNonce += 1
    return `${options.peerId}:${startNonce}`
  }

  function nextSetupNonce() {
    setupNonce += 1
    return `${options.peerId}:setup:${setupNonce}`
  }

  function applySetup(input: BoothSessionSetup) {
    sessionSetup = normalizeBoothSetup(input)
    if (!slotLocked) pairSlot = pairSlotForLayout(sessionSetup.layoutId)
    const event = { ...sessionSetup }
    const waiter = setupWaiters.shift()
    if (waiter) waiter.resolve(event)
    else setupQueue.push(event)
  }

  function clearMoment(momentIndex: number) {
    hostStills.delete(momentIndex)
    guestStills.delete(momentIndex)
    composed.delete(momentIndex)
    composeJobs.delete(momentIndex)
    composeGeneration.set(momentIndex, (composeGeneration.get(momentIndex) ?? 0) + 1)
  }

  function clearAllMoments() {
    hostStills.clear()
    guestStills.clear()
    composed.clear()
    composeJobs.clear()
    startedMoments.clear()
    startedNonces.clear()
    startQueue.length = 0
    for (const momentIndex of composeGeneration.keys()) {
      composeGeneration.set(momentIndex, (composeGeneration.get(momentIndex) ?? 0) + 1)
    }
  }

  function emitReset() {
    const waiter = resetWaiters.shift()
    if (waiter) waiter.resolve()
    else resetQueued += 1
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

  function emitStart(
    momentIndex: number,
    countdownMs: number,
    start?: { nonce?: string },
  ) {
    clearMoment(momentIndex)
    startedMoments.set(momentIndex, countdownMs)
    if (start?.nonce) startedNonces.set(momentIndex, start.nonce)
    const waiters = countdownWaiters.get(momentIndex) ?? []
    countdownWaiters.delete(momentIndex)
    for (const waiter of waiters) waiter.resolve(countdownMs)

    const event = { momentIndex, countdownMs }
    const startWaiter = startWaiters.shift()
    if (startWaiter) {
      startWaiter.resolve(event)
      return
    }
    const queuedIndex = startQueue.findIndex((queued) => queued.momentIndex === momentIndex)
    if (queuedIndex >= 0) startQueue[queuedIndex] = event
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
      if (composed.has(momentIndex) || disposed) return
    }

    if (disposed || composed.has(momentIndex)) return

    const hostStill = hostStills.get(momentIndex)
    const guestStill = guestStills.get(momentIndex)
    if (!hostStill || !guestStill) return

    const generation = composeGeneration.get(momentIndex) ?? 0
    const slot = pairSlot ?? options.slot
    const job = (async () => {
      try {
        const shot = await composePairRow(hostStill, guestStill, slot)
        if (disposed) return
        if ((composeGeneration.get(momentIndex) ?? 0) !== generation) return
        resolveComposed(momentIndex, shot)
      } catch (error) {
        if ((composeGeneration.get(momentIndex) ?? 0) !== generation) return
        rejectComposed(momentIndex, error)
        throw error
      }
    })()

    composeJobs.set(momentIndex, job)
    try {
      await job
    } finally {
      if (composeJobs.get(momentIndex) === job) composeJobs.delete(momentIndex)
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
      isDuplicate(`start:${nonce}`, 10_000)
      options.transport.send({ type: 'start-moment', momentIndex, countdownMs, nonce })
      emitStart(momentIndex, countdownMs, { nonce })
    },
    setSetup(setup) {
      if (disposed) {
        throw new Error('Booth session disposed')
      }
      if (options.role !== 'host') {
        throw new Error('Only the booth host can choose the shared strip setup.')
      }
      applySetup(setup)
      options.transport.send({
        type: 'session-setup',
        ...normalizeBoothSetup(setup),
        nonce: nextSetupNonce(),
      })
    },
    resetCapture() {
      if (disposed) {
        throw new Error('Booth session disposed')
      }
      if (options.role !== 'host') {
        throw new Error('Only the booth host can reset the shared capture.')
      }
      clearAllMoments()
      emitReset()
      options.transport.send({
        type: 'session-reset',
        nonce: `${options.peerId}:reset:${nextStartNonce()}`,
      })
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
        faceBounds: still.faceBounds?.map((face) => ({ ...face })),
        cameraEffectFrameMs: still.cameraEffectFrameMs,
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
    waitForSetup() {
      if (disposed) return Promise.reject(new Error('Booth session disposed'))
      const queued = setupQueue.shift()
      if (queued) return Promise.resolve(queued)

      return new Promise((resolve, reject) => {
        setupWaiters.push({ resolve, reject })
      })
    },
    waitForReset() {
      if (disposed) return Promise.reject(new Error('Booth session disposed'))
      if (resetQueued > 0) {
        resetQueued -= 1
        return Promise.resolve()
      }

      return new Promise((resolve, reject) => {
        resetWaiters.push({ resolve, reject })
      })
    },
    getSetup() {
      return sessionSetup ? { ...sessionSetup } : null
    },
    getComposedShots() {
      return [...composed.entries()]
        .sort((left, right) => left[0] - right[0])
        .map(([, shot]) => shot)
    },
    getComposedByOrder() {
      return [...composed.entries()]
        .sort((left, right) => left[0] - right[0])
        .map(([order, shot]) => ({ order, shot }))
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
      const pendingSetups = [...setupWaiters]
      const pendingResets = [...resetWaiters]
      composedWaiters.clear()
      countdownWaiters.clear()
      startWaiters.length = 0
      startQueue.length = 0
      setupWaiters.length = 0
      setupQueue.length = 0
      resetWaiters.length = 0
      resetQueued = 0
      const disposedError = new Error('Booth session disposed')
      for (const [, waiters] of pending) {
        for (const waiter of waiters) waiter.reject(disposedError)
      }
      for (const waiter of pendingCountdowns) waiter.reject(disposedError)
      for (const waiter of pendingStarts) waiter.reject(disposedError)
      for (const waiter of pendingSetups) waiter.reject(disposedError)
      for (const waiter of pendingResets) waiter.reject(disposedError)
    },
  }

  return session
}

export function createPeerId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `peer-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
}
