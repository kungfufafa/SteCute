import { db, type Shot } from '../schema'
import { restoreIndexedDbBlob, writeBlobWithFallback } from '../blob'

function restoreShotBlob(shot: Shot): Shot {
  return {
    ...shot,
    blob: restoreIndexedDbBlob(shot.blob),
    liveClipBlob: shot.liveClipBlob ? restoreIndexedDbBlob(shot.liveClipBlob) : undefined,
  }
}

export class ShotRepository {
  async create(shot: Omit<Shot, 'id'>): Promise<string> {
    const id = crypto.randomUUID()
    await writeBlobWithFallback(shot.blob, async (blob) => {
      if (!shot.liveClipBlob) {
        await db.shots.add({ ...shot, blob, id })
        return
      }

      await writeBlobWithFallback(shot.liveClipBlob, (liveClipBlob) =>
        db.shots.add({ ...shot, blob, liveClipBlob, id }),
      )
    })
    return id
  }

  async getBySession(sessionId: string): Promise<Shot[]> {
    const shots = await db.shots.where('sessionId').equals(sessionId).sortBy('order')
    return shots.map(restoreShotBlob)
  }

  async getBySessionAndOrder(sessionId: string, order: number): Promise<Shot | undefined> {
    const shot = await db.shots.where('[sessionId+order]').equals([sessionId, order]).first()
    return shot ? restoreShotBlob(shot) : undefined
  }

  async delete(id: string): Promise<void> {
    await db.shots.delete(id)
  }

  async deleteBySession(sessionId: string): Promise<void> {
    await db.shots.where('sessionId').equals(sessionId).delete()
  }

  async replaceShot(
    sessionId: string,
    order: number,
    blob: Blob,
    width: number,
    height: number,
    faceBounds: Shot['faceBounds'] = [],
    cameraEffectId = 'none',
    cameraEffectFrameMs = 0,
    liveClip?: Pick<
      Shot,
      | 'liveClipBlob'
      | 'liveClipMimeType'
      | 'liveClipDurationMs'
      | 'liveClipWidth'
      | 'liveClipHeight'
      | 'liveClipMirrored'
    >,
  ): Promise<void> {
    const existing = await this.getBySessionAndOrder(sessionId, order)
    if (existing) {
      await writeBlobWithFallback(blob, async (storedBlob) => {
        if (liveClip?.liveClipBlob) {
          await writeBlobWithFallback(liveClip.liveClipBlob, async (storedLiveClipBlob) => {
            await db.shots.update(existing.id, {
              blob: storedBlob,
              width,
              height,
              faceBounds,
              cameraEffectId,
              cameraEffectFrameMs,
              liveClipBlob: storedLiveClipBlob,
              liveClipMimeType: liveClip.liveClipMimeType,
              liveClipDurationMs: liveClip.liveClipDurationMs,
              liveClipWidth: liveClip.liveClipWidth,
              liveClipHeight: liveClip.liveClipHeight,
              liveClipMirrored: liveClip.liveClipMirrored,
              createdAt: Date.now(),
            })
          })
          return
        }

        await db.shots.update(existing.id, {
          blob: storedBlob,
          width,
          height,
          faceBounds,
          cameraEffectId,
          cameraEffectFrameMs,
          liveClipBlob: null,
          liveClipMimeType: null,
          liveClipDurationMs: null,
          liveClipWidth: null,
          liveClipHeight: null,
          liveClipMirrored: null,
          createdAt: Date.now(),
        })
      })
    }
  }
}
