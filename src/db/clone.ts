import type { DecorationConfig, Shot, ShotFaceBounds } from './schema'

export function cloneFaceBounds(bounds?: ShotFaceBounds[] | null): ShotFaceBounds[] {
  if (!bounds?.length) return []
  return Array.from(bounds, (face) => ({
    x: Number(face.x),
    y: Number(face.y),
    width: Number(face.width),
    height: Number(face.height),
  }))
}

export function cloneDecorationConfig(config: DecorationConfig): DecorationConfig {
  return {
    filterId: String(config.filterId ?? 'normal'),
    cameraEffectId: String(config.cameraEffectId ?? 'none'),
    frameColor: String(config.frameColor ?? '#ffffff'),
    selectedStickerIds: Array.from(config.selectedStickerIds ?? [], (id) => String(id)),
    showDateTime: Boolean(config.showDateTime),
    logoText: String(config.logoText ?? ''),
  }
}

export function cloneShotRecord(shot: Omit<Shot, 'id'>, id: string): Shot {
  return {
    id,
    sessionId: String(shot.sessionId),
    order: Number(shot.order),
    sourceType: shot.sourceType === 'upload' ? 'upload' : 'camera',
    blob: shot.blob,
    width: Number(shot.width),
    height: Number(shot.height),
    liveClipBlob: shot.liveClipBlob ?? null,
    liveClipMimeType: shot.liveClipMimeType ?? null,
    liveClipDurationMs:
      shot.liveClipDurationMs == null ? null : Number(shot.liveClipDurationMs),
    liveClipWidth: shot.liveClipWidth == null ? null : Number(shot.liveClipWidth),
    liveClipHeight: shot.liveClipHeight == null ? null : Number(shot.liveClipHeight),
    liveClipMirrored: shot.liveClipMirrored == null ? null : Boolean(shot.liveClipMirrored),
    faceBounds: cloneFaceBounds(shot.faceBounds),
    cameraEffectId: String(shot.cameraEffectId ?? 'none'),
    cameraEffectFrameMs: Number(shot.cameraEffectFrameMs ?? 0),
    createdAt: Number(shot.createdAt),
  }
}
