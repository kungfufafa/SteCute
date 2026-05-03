import { db, type Session, type DecorationConfig } from '../schema'

export class SessionRepository {
  async create(session: Omit<Session, 'id'>): Promise<string> {
    const id = crypto.randomUUID()
    await db.sessions.add({ ...session, id })
    return id
  }

  async getById(id: string): Promise<Session | undefined> {
    return db.sessions.get(id)
  }

  async getRecent(limit: number = 20): Promise<Session[]> {
    return db.sessions.orderBy('startedAt').reverse().limit(limit).toArray()
  }

  async updateStatus(id: string, status: Session['status']): Promise<void> {
    await db.sessions.update(id, {
      status,
      ...(status === 'completed' ? { completedAt: Date.now() } : {}),
    })
  }

  async setFinalRender(sessionId: string, renderId: string): Promise<void> {
    await db.sessions.update(sessionId, { finalRenderId: renderId })
  }

  async updateDecorationConfig(sessionId: string, config: DecorationConfig): Promise<void> {
    await db.sessions.update(sessionId, { decorationConfig: config })
  }

  async delete(id: string): Promise<void> {
    await db.sessions.delete(id)
  }

  async cleanupStaleSessions(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<void> {
    const cutoff = Date.now() - maxAgeMs
    const stale = await db.sessions.where('startedAt').below(cutoff).toArray()
    const staleIds = stale.map((s) => s.id)
    if (staleIds.length > 0) {
      await db.shots.where('sessionId').anyOf(staleIds).delete()
      await db.renders.where('sessionId').anyOf(staleIds).delete()
      await db.sessions.bulkDelete(staleIds)
    }
  }

  async clearAll(): Promise<void> {
    await db.sessions.clear()
  }
}
