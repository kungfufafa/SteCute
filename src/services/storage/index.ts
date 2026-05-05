import { db } from '@/db/schema'

export const STORAGE_SOFT_WARNING_BYTES = 70 * 1024 * 1024
const STORAGE_QUOTA_WARNING_RATIO = 0.8

export interface StorageState {
  supported: boolean
  usageBytes: number
  quotaBytes: number | null
  usageRatio: number | null
  persistent: boolean | null
  shouldWarn: boolean
}

export function isStorageQuotaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const details = error as { name?: unknown; code?: unknown; message?: unknown }
  const name = String(details.name ?? '')
  const message = String(details.message ?? '')

  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    details.code === 22 ||
    details.code === 1014 ||
    /quota|storage full|not enough space/i.test(message)
  )
}

export function getStorageErrorMessage(error: unknown): string {
  if (isStorageQuotaError(error)) {
    return 'Penyimpanan browser penuh. Hapus beberapa hasil lama di galeri, lalu coba lagi.'
  }

  return 'Gagal menyimpan data lokal. Silakan coba lagi.'
}

export async function getStorageState(): Promise<StorageState> {
  if (!('storage' in navigator) || !navigator.storage.estimate) {
    return {
      supported: false,
      usageBytes: 0,
      quotaBytes: null,
      usageRatio: null,
      persistent: null,
      shouldWarn: false,
    }
  }

  const [estimate, persistent] = await Promise.all([
    navigator.storage.estimate(),
    navigator.storage.persisted?.() ?? Promise.resolve(null),
  ])
  const usageBytes = estimate.usage ?? 0
  const quotaBytes = estimate.quota ?? null
  const usageRatio = quotaBytes && quotaBytes > 0 ? usageBytes / quotaBytes : null

  return {
    supported: true,
    usageBytes,
    quotaBytes,
    usageRatio,
    persistent,
    shouldWarn:
      usageBytes >= STORAGE_SOFT_WARNING_BYTES ||
      (usageRatio !== null && usageRatio >= STORAGE_QUOTA_WARNING_RATIO),
  }
}

export async function requestPersistentStorage(): Promise<boolean | null> {
  if (!('storage' in navigator) || !navigator.storage.persist) return null

  try {
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export async function clearApplicationCaches(): Promise<void> {
  if (!('caches' in globalThis)) return

  const cacheKeys = await caches.keys()
  await Promise.all(cacheKeys.map((key) => caches.delete(key)))
}

export async function clearAllLocalData(): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.appSettings,
      db.sessions,
      db.shots,
      db.renders,
      db.layouts,
      db.templates,
      db.assets,
      db.eventPresets,
    ],
    async () => {
      await db.appSettings.clear()
      await db.sessions.clear()
      await db.shots.clear()
      await db.renders.clear()
      await db.layouts.clear()
      await db.templates.clear()
      await db.assets.clear()
      await db.eventPresets.clear()
    },
  )

  await clearApplicationCaches()
}
