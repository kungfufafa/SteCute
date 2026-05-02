import { db, type Shot } from '../schema'
import { restoreIndexedDbBlob, writeBlobWithFallback } from '../blob'

function restoreShotBlob(shot: Shot): Shot {
  return { ...shot, blob: restoreIndexedDbBlob(shot.blob) }
}

export class ShotRepository {
  async create(shot: Omit<Shot, 'id'>): Promise<string> {
    const id = crypto.randomUUID()
    await writeBlobWithFallback(shot.blob, (blob) => db.shots.add({ ...shot, blob, id }))
    return id
  }

  async getBySession(sessionId: string): Promise<Shot[]> {
    const shots = await db.shots.where('sessionId').equals(sessionId).sortBy('order')
    return shots.map(restoreShotBlob)
  }

  async getBySessionAndOrder(sessionId: string, order: number): Promise<Shot | undefined> {
    const shot = await db.shots.where({ sessionId, order }).first()
    return shot ? restoreShotBlob(shot) : undefined
  }

  async delete(id: string): Promise<void> {
    await db.shots.delete(id)
  }

  async deleteBySession(sessionId: string): Promise<void> {
    await db.shots.where('sessionId').equals(sessionId).delete()
  }

  async replaceShot(sessionId: string, order: number, blob: Blob, width: number, height: number): Promise<void> {
    const existing = await this.getBySessionAndOrder(sessionId, order)
    if (existing) {
      await writeBlobWithFallback(blob, async (storedBlob) => {
        await db.shots.update(existing.id, { blob: storedBlob, width, height, createdAt: Date.now() })
      })
    }
  }
}
