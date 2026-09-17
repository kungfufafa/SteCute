import { restoreIndexedDbBlob, writeBlobWithFallback } from '../blob'
import { db, type AssetRecord } from '../schema'

export class AssetRepository {
  async getAll(): Promise<AssetRecord[]> {
    return db.assets.toArray()
  }

  async getByType(type: AssetRecord['type']): Promise<AssetRecord[]> {
    return db.assets.where('type').equals(type).toArray()
  }

  async getByPackId(packId: string): Promise<AssetRecord[]> {
    return db.assets.where('packId').equals(packId).toArray()
  }

  async upsert(record: Omit<AssetRecord, 'updatedAt'>): Promise<void> {
    await db.assets.put({ ...record, updatedAt: Date.now() })
  }

  async seed(assets: Omit<AssetRecord, 'updatedAt'>[]): Promise<void> {
    const now = Date.now()
    const records = assets.map((a) => ({ ...a, updatedAt: now }))
    await db.assets.bulkPut(records)
  }

  async saveSessionBackgroundAsset(
    sessionId: string,
    assetId: string,
    blob: Blob,
  ): Promise<void> {
    await writeBlobWithFallback(blob, async (storedBlob) => {
      await db.assets.put({
        id: assetId,
        type: 'virtual-background',
        name: `bg-${assetId}`,
        path: '',
        packId: sessionId,
        isBundled: false,
        blob: storedBlob,
        updatedAt: Date.now(),
      })
    })
  }

  async getSessionBackgroundAsset(assetId: string): Promise<Blob | null> {
    const record = await db.assets.get(assetId)
    if (!record || (!record.blob && !record.assetBlob)) return null
    try {
      return restoreIndexedDbBlob(record.blob ?? record.assetBlob!)
    } catch {
      return null
    }
  }

  async deleteBySessionId(sessionId: string): Promise<void> {
    await db.assets.where('packId').equals(sessionId).delete()
  }

  async clearAll(): Promise<void> {
    await db.assets.clear()
  }
}
