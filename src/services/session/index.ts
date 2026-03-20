import type { DecorationConfig, Session, Shot } from '@/db/schema'
import { type LayoutConfig, type TemplateConfig } from '@/db/schema'
import { db } from '@/db/schema'
import { RenderRepository, SessionRepository, ShotRepository } from '@/db/repositories'
import { renderStrip } from '@/services/render'

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

function normalizeDecorationConfig(input?: Partial<DecorationConfig>): DecorationConfig {
  return {
    filterId: input?.filterId ?? 'normal',
    frameColor: input?.frameColor ?? '#ffffff',
    selectedStickerIds: Array.isArray(input?.selectedStickerIds)
      ? [...input.selectedStickerIds]
      : [],
    showDateTime: input?.showDateTime ?? false,
    logoText: input?.logoText ?? '',
  }
}

export function createDecorationConfig(input?: Partial<DecorationConfig>): DecorationConfig {
  return normalizeDecorationConfig(input)
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
    await sessionRepo.updateDecorationConfig(
      existingSessionId,
      normalizeDecorationConfig(config.decoration),
    )
    return existingSessionId
  }

  return createSession(config)
}

export async function saveShot(params: {
  sessionId: string
  order: number
  sourceType: 'camera' | 'upload'
  blob: Blob
  width: number
  height: number
}): Promise<string> {
  const existing = await shotRepo.getBySessionAndOrder(params.sessionId, params.order)

  if (existing) {
    await shotRepo.replaceShot(
      params.sessionId,
      params.order,
      params.blob,
      params.width,
      params.height,
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
    createdAt: Date.now(),
  })
}

export async function getSessionShots(sessionId: string): Promise<Shot[]> {
  return shotRepo.getBySession(sessionId)
}

export async function resetSessionData(sessionId: string): Promise<void> {
  await shotRepo.deleteBySession(sessionId)
  await sessionRepo.delete(sessionId)
}

export async function renderAndStoreSession(params: {
  sessionId: string
  layout: LayoutConfig
  template: TemplateConfig
  decoration: DecorationConfig
  format?: 'image/png' | 'image/jpeg'
}): Promise<string> {
  const shots = await getSessionShots(params.sessionId)
  const decoration = normalizeDecorationConfig(params.decoration)
  await sessionRepo.updateDecorationConfig(params.sessionId, decoration)

  const result = await renderStrip({
    layout: params.layout,
    template: params.template,
    shots,
    decoration,
    format: params.format ?? 'image/png',
  })

  const renderId = await renderRepo.create({
    sessionId: params.sessionId,
    mimeType: params.format ?? 'image/png',
    variant: 'default',
    blob: result.blob,
    width: result.width,
    height: result.height,
    createdAt: Date.now(),
    savedToDeviceAt: null,
  })

  await renderRepo.deleteOldRenders()
  await db.transaction('rw', db.sessions, db.renders, async () => {
    await sessionRepo.setFinalRender(params.sessionId, renderId)
    await sessionRepo.updateStatus(params.sessionId, 'completed')
  })

  return renderId
}

export async function getRenderBlobById(renderId: string): Promise<Blob | null> {
  const render = await renderRepo.getById(renderId)
  return render?.blob ?? null
}

export async function loadSessionRecord(sessionId: string): Promise<Session | undefined> {
  return sessionRepo.getById(sessionId)
}
