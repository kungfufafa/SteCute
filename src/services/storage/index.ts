import { db } from '@/db/schema'
import { RenderRepository, SessionRepository, ShotRepository } from '@/db/repositories'

export async function resetCurrentSession(sessionId: string): Promise<void> {
  const sessionRepo = new SessionRepository()
  const shotRepo = new ShotRepository()

  await shotRepo.deleteBySession(sessionId)
  await sessionRepo.delete(sessionId)
}

export async function clearAllData(): Promise<void> {
  await Promise.all([
    db.appSettings.clear(),
    db.shots.clear(),
    db.renders.clear(),
    db.sessions.clear(),
  ])
}

export async function cleanupStaleData(): Promise<void> {
  const sessionRepo = new SessionRepository()
  const renderRepo = new RenderRepository()

  await sessionRepo.cleanupStaleSessions()
  await renderRepo.deleteOldRenders()
}

export async function getStorageQuota(): Promise<{ usage: number; quota: number } | null> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate()
    return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 }
  }
  return null
}

export const STORAGE_WARNING_THRESHOLD = 70 * 1024 * 1024 // 70 MB
