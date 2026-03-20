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

  async clearAll(): Promise<void> {
    await db.assets.clear()
  }
}
