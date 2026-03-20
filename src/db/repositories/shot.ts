import { db, type Shot } from '../schema'

export class ShotRepository {
  async create(shot: Omit<Shot, 'id'>): Promise<string> {
    const id = crypto.randomUUID()
    await db.shots.add({ ...shot, id })
    return id
  }

  async getBySession(sessionId: string): Promise<Shot[]> {
    return db.shots.where('sessionId').equals(sessionId).sortBy('order')
  }

  async getBySessionAndOrder(sessionId: string, order: number): Promise<Shot | undefined> {
    return db.shots.where({ sessionId, order }).first()
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
      await db.shots.update(existing.id, { blob, width, height, createdAt: Date.now() })
    }
  }
}
