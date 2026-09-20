import type { DecorationConfig, Render, Session, Shot } from '@/db/schema'
import { type LayoutConfig, type TemplateConfig } from '@/db/schema'
import { db } from '@/db/schema'
import {
  AssetRepository,
  RenderRepository,
  SessionRepository,
  ShotRepository,
} from '@/db/repositories'
import { normalizeCameraEffectId } from '@/services/camera-effects'
import { normalizePhotoFilterId } from '@/services/filter'
import { normalizeVirtualBackgroundId } from '@/services/virtual-background'
import type { LiveCamClip } from '@/services/live-cam'
import { renderLiveStrip } from '@/services/live-cam'
import { renderStrip } from '@/services/render'
import { getStorageErrorMessage } from '@/services/storage'

export interface SessionFlowConfig {
  layoutId: string
  templateId: string
  slotCount: number
  captureSource: 'camera' | 'upload'
  decoration: DecorationConfig
}

const sessionRepo = new SessionRepository()
const shotRepo = new ShotRepository()
const renderRepo = new RenderRepository()
const assetRepo = new AssetRepository()

export interface SessionSnapshot {
  session: Session
  shots: Shot[]
}

function normalizeDecorationConfig(input?: Partial<DecorationConfig>): DecorationConfig {
  return {
    filterId: normalizePhotoFilterId(input?.filterId),
    cameraEffectId: normalizeCameraEffectId(input?.cameraEffectId),
    virtualBackgroundId: normalizeVirtualBackgroundId(input?.virtualBackgroundId),
    virtualBackgroundAssetId: input?.virtualBackgroundAssetId ?? null,
    frameColor: input?.frameColor ?? '#ffffff',
    selectedStickerIds: Array.isArray(input?.selectedStickerIds)
      ? [...input.selectedStickerIds]
      : [],
    showDateTime: input?.showDateTime ?? false,
    logoText: input?.logoText ?? '',
  }
}

export function createDefaultDecorationConfig(
  template?: Pick<TemplateConfig, 'defaultFrameColor'>,
  overrides: Partial<DecorationConfig> = {},
): DecorationConfig {
  return normalizeDecorationConfig({
    frameColor: template?.defaultFrameColor,
    ...overrides,
  })
}

export function isSessionComplete(shots: Array<{ order: number }>, slotCount: number): boolean {
  if (slotCount <= 0) return false

  const orders = new Set(shots.map((shot) => shot.order))
  return Array.from({ length: slotCount }, (_, index) => index).every((order) => orders.has(order))
}

function sessionMatchesFlow(session: Session, config: SessionFlowConfig): boolean {
  return (
    session.status !== 'completed' &&
    session.status !== 'discarded' &&
    !session.finalRenderId &&
    session.layoutId === config.layoutId &&
    session.templateId === config.templateId &&
    session.slotCount === config.slotCount &&
    session.captureSource === config.captureSource
  )
}

export async function createSession(config: SessionFlowConfig): Promise<string> {
  return sessionRepo.create({
    status: 'idle',
    captureSource: config.captureSource,
    layoutId: config.layoutId,
    templateId: config.templateId,
    slotCount: config.slotCount,
    decorationConfig: normalizeDecorationConfig(config.decoration),
    startedAt: Date.now(),
    completedAt: null,
    finalRenderId: null,
  })
}

export async function ensureSession(
  existingSessionId: string | null,
  config: SessionFlowConfig,
): Promise<string> {
  if (existingSessionId) {
    const existing = await sessionRepo.getById(existingSessionId)

    if (existing && sessionMatchesFlow(existing, config)) {
      await sessionRepo.updateDecorationConfig(
        existingSessionId,
        normalizeDecorationConfig(config.decoration),
      )
      return existingSessionId
    }

    await resetSessionData(existingSessionId)
  }

  return createSession(config)
}

export async function updateSessionDecorationConfig(
  sessionId: string,
  decoration: Partial<DecorationConfig>,
): Promise<void> {
  await sessionRepo.updateDecorationConfig(sessionId, normalizeDecorationConfig(decoration))
}

export async function saveShot(params: {
  sessionId: string
  order: number
  sourceType: 'camera' | 'upload'
  blob: Blob
  width: number
  height: number
  faceBounds?: Shot['faceBounds']
  cameraEffectId?: string
  cameraEffectFrameMs?: number
  liveClip?: LiveCamClip | null
}): Promise<string> {
  const existing = await shotRepo.getBySessionAndOrder(params.sessionId, params.order)
  const liveClip = params.liveClip?.blob
    ? {
        liveClipBlob: params.liveClip.blob,
        liveClipMimeType: String(params.liveClip.mimeType || 'video/webm'),
        liveClipDurationMs: Number(params.liveClip.durationMs) || 0,
        liveClipWidth: Number(params.liveClip.width) || 0,
        liveClipHeight: Number(params.liveClip.height) || 0,
        liveClipMirrored: Boolean(params.liveClip.mirrored),
      }
    : undefined

  if (existing) {
    await shotRepo.replaceShot(
      params.sessionId,
      params.order,
      params.blob,
      params.width,
      params.height,
      params.faceBounds,
      normalizeCameraEffectId(params.cameraEffectId),
      params.cameraEffectFrameMs,
      liveClip,
    )

    return existing.id
  }

  return shotRepo.create({
    sessionId: params.sessionId,
    order: params.order,
    sourceType: params.sourceType,
    blob: params.blob,
    width: params.width,
    height: params.height,
    faceBounds: params.faceBounds ?? [],
    cameraEffectId: normalizeCameraEffectId(params.cameraEffectId),
    cameraEffectFrameMs: params.cameraEffectFrameMs ?? 0,
    ...liveClip,
    createdAt: Date.now(),
  })
}

export async function getSessionShots(sessionId: string): Promise<Shot[]> {
  return shotRepo.getBySession(sessionId)
}

export async function getSessionSnapshot(sessionId: string): Promise<SessionSnapshot | null> {
  const session = await sessionRepo.getById(sessionId)

  if (!session) return null

  return {
    session,
    shots: await getSessionShots(session.id),
  }
}

export async function getReviewSessionSnapshot(
  currentSessionId: string | null,
): Promise<SessionSnapshot | null> {
  if (!currentSessionId) return null

  const snapshot = await getSessionSnapshot(currentSessionId)
  if (!snapshot) return null

  if (snapshot.session.finalRenderId) return snapshot

  if (isSessionComplete(snapshot.shots, snapshot.session.slotCount)) {
    return snapshot
  }

  return null
}

export async function getLatestIncompleteCameraSnapshot(): Promise<SessionSnapshot | null> {
  const sessions = await sessionRepo.getRecent()

  for (const session of sessions) {
    if (session.captureSource !== 'camera') continue
    if (session.status === 'discarded' || session.status === 'completed' || session.finalRenderId) {
      continue
    }

    const shots = await getSessionShots(session.id)

    if (shots.length > 0 && !isSessionComplete(shots, session.slotCount)) {
      return { session, shots }
    }
  }

  return null
}

export async function abandonIncompleteSession(sessionId: string | null): Promise<void> {
  if (!sessionId) return

  const snapshot = await getSessionSnapshot(sessionId)
  if (!snapshot || snapshot.session.status === 'completed' || snapshot.session.finalRenderId) {
    return
  }

  if (isSessionComplete(snapshot.shots, snapshot.session.slotCount)) return

  await resetSessionData(sessionId)
}

export async function resetSessionData(sessionId: string): Promise<void> {
  await shotRepo.deleteBySession(sessionId)
  await assetRepo.deleteBySessionId(sessionId)
  await sessionRepo.delete(sessionId)
}

export async function saveSessionBackgroundAsset(
  sessionId: string,
  assetId: string,
  blob: Blob,
): Promise<void> {
  await assetRepo.saveSessionBackgroundAsset(sessionId, assetId, blob)
}

export async function getSessionBackgroundAsset(assetId: string): Promise<Blob | null> {
  return assetRepo.getSessionBackgroundAsset(assetId)
}

export async function deleteSessionBackgroundAssets(sessionId: string): Promise<void> {
  await assetRepo.deleteBySessionId(sessionId)
}

export interface SessionRenderParams {
  sessionId: string
  // Duet already owns its composed snapshots in memory; rendering must not require
  // storing a second copy of every source image first.
  shots?: Shot[]
  signal?: AbortSignal
  layout: LayoutConfig
  template: TemplateConfig
  decoration: DecorationConfig
  format?: 'image/png' | 'image/jpeg'
}

export interface SessionRenderResult {
  render: Render
  persisted: boolean
  storageWarning: string | null
}

// A cancelled view no longer owns the session or any later edits to its photos.
const activeRenderJobs = new Map<
  string,
  { promise: Promise<SessionRenderResult>; signal?: AbortSignal }
>()

function throwIfRenderAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Render dibatalkan.', 'AbortError')
}

export function renderSessionForOutput(params: SessionRenderParams): Promise<SessionRenderResult> {
  const active = activeRenderJobs.get(params.sessionId)
  if (active && !active.signal?.aborted) return active.promise

  const job = createSessionOutput(params).finally(() => {
    if (activeRenderJobs.get(params.sessionId)?.promise === job) {
      activeRenderJobs.delete(params.sessionId)
    }
  })
  activeRenderJobs.set(params.sessionId, { promise: job, signal: params.signal })
  return job
}

async function createSessionOutput(params: SessionRenderParams): Promise<SessionRenderResult> {
  const assertActive = () => throwIfRenderAborted(params.signal)
  const discardAbortedRender = async (renderId: string) => {
    if (!params.signal?.aborted) return
    try {
      // Only remove this job's artifact, never the source session being edited.
      await renderRepo.delete(renderId)
    } catch (error) {
      console.warn('Could not remove the cancelled render.', error)
    }
    assertActive()
  }
  assertActive()
  const shots = params.shots ?? (await getSessionShots(params.sessionId))
  assertActive()
  if (!isSessionComplete(shots, params.layout.slotCount)) {
    throw new Error('Foto sesi belum lengkap. Lengkapi foto sebelum membuat hasil.')
  }
  const decoration = normalizeDecorationConfig(params.decoration)
  const result = await renderStrip({
    layout: params.layout,
    template: params.template,
    shots,
    decoration,
    format: params.format ?? 'image/png',
  })
  assertActive()
  let liveResult: Awaited<ReturnType<typeof renderLiveStrip>> = null

  if (shots.some((shot) => shot.liveClipBlob)) {
    try {
      liveResult = await renderLiveStrip({
        layout: params.layout,
        template: params.template,
        shots,
        decoration,
        baseImageBlob: result.blob,
      })
    } catch (error) {
      console.warn('Live Cam render failed; keeping photo output.', error)
    }
  }
  assertActive()

  let render: Render = {
    id: `memory-${crypto.randomUUID()}`,
    sessionId: params.sessionId,
    layoutId: params.layout.id,
    templateId: params.template.id,
    mimeType: params.format ?? 'image/png',
    variant: 'default',
    blob: result.blob,
    width: result.width,
    height: result.height,
    sizeBytes: result.blob.size,
    liveBlob: liveResult?.blob,
    liveMimeType: liveResult?.mimeType,
    liveSizeBytes: liveResult?.blob.size,
    liveWidth: liveResult?.width,
    liveHeight: liveResult?.height,
    liveDurationMs: liveResult?.durationMs,
    createdAt: Date.now(),
    savedToDeviceAt: null,
  }
  let storageWarning: string | null = null

  // Rendering has succeeded. A storage failure must not discard the downloadable artifact.
  try {
    let renderId: string
    try {
      renderId = await renderRepo.create(render)
    } catch (error) {
      assertActive()
      if (!render.liveBlob) throw error
      const photoOnly: Render = {
        ...render,
        liveBlob: undefined,
        liveMimeType: undefined,
        liveSizeBytes: undefined,
        liveWidth: undefined,
        liveHeight: undefined,
        liveDurationMs: undefined,
      }
      renderId = await renderRepo.create(photoOnly)
      render = photoOnly
      storageWarning = 'Live Cam belum dapat disimpan. Foto PNG tetap tersedia.'
    }
    render = { ...render, id: renderId }
    await discardAbortedRender(renderId)
    assertActive()
  } catch (error) {
    assertActive()
    return {
      render,
      persisted: false,
      storageWarning: `Hasil belum tersimpan di galeri. ${getStorageErrorMessage(error)} Unduh hasil sebelum menutup halaman.`,
    }
  }

  // Finalization/retention errors do not turn an already saved output into a failed render.
  let finalized = false
  try {
    await db.transaction('rw', db.sessions, db.shots, db.renders, db.assets, async () => {
      assertActive()
      if (params.shots) {
        await db.sessions.put({
          id: params.sessionId,
          status: 'completed',
          captureSource: shots[0]?.sourceType ?? 'camera',
          layoutId: params.layout.id,
          templateId: params.template.id,
          slotCount: params.layout.slotCount,
          decorationConfig: decoration,
          startedAt: Math.min(...shots.map((shot) => shot.createdAt)),
          completedAt: Date.now(),
          finalRenderId: render.id,
        })
      } else {
        await sessionRepo.updateDecorationConfig(params.sessionId, decoration)
        assertActive()
        await sessionRepo.setFinalRender(params.sessionId, render.id)
        assertActive()
        await sessionRepo.updateStatus(params.sessionId, 'completed')
      }
      assertActive()
      await shotRepo.deleteBySession(params.sessionId)
      assertActive()
      await assetRepo.deleteBySessionId(params.sessionId)
      // Throwing inside the transaction rolls back cleanup if navigation aborted it.
      assertActive()
    })
    finalized = true

    assertActive()
    const deletedRenders = await renderRepo.deleteOldRenders()
    const deletedSessionIds = Array.from(
      new Set(deletedRenders.map((item) => item.sessionId).filter(Boolean)),
    )
    if (deletedSessionIds.length > 0) {
      await db.transaction('rw', db.sessions, db.shots, db.assets, async () => {
        await Promise.all(deletedSessionIds.map((id) => shotRepo.deleteBySession(id)))
        await Promise.all(deletedSessionIds.map((id) => assetRepo.deleteBySessionId(id)))
        await db.sessions.bulkDelete(deletedSessionIds)
      })
    }
  } catch (error) {
    if (!finalized) await discardAbortedRender(render.id)
    assertActive()
    console.warn('Output saved, but session cleanup failed.', error)
    storageWarning = 'Hasil tersimpan di galeri, tetapi pembersihan data sesi belum selesai.'
  }

  assertActive()
  return { render, persisted: true, storageWarning }
}

// Compatibility for callers that explicitly require a persisted render ID.
export async function renderAndStoreSession(params: SessionRenderParams): Promise<string> {
  const output = await renderSessionForOutput(params)
  if (!output.persisted) throw new Error(output.storageWarning ?? 'Gagal menyimpan hasil.')
  return output.render.id
}

export async function getRenderById(renderId: string): Promise<Render | null> {
  return (await renderRepo.getById(renderId)) ?? null
}
