import { db, type LayoutRecord, type LayoutConfig } from '../schema'

export class LayoutRepository {
  async getAll(): Promise<LayoutRecord[]> {
    return db.layouts.toArray()
  }

  async getById(id: string): Promise<LayoutRecord | undefined> {
    return db.layouts.get(id)
  }

  async getLayoutConfig(id: string): Promise<LayoutConfig | undefined> {
    const record = await db.layouts.get(id)
    return record?.config
  }

  async upsert(record: Omit<LayoutRecord, 'updatedAt'>): Promise<void> {
    await db.layouts.put({ ...record, updatedAt: Date.now() })
  }

  async seed(layouts: Omit<LayoutRecord, 'updatedAt'>[]): Promise<void> {
    const now = Date.now()
    const records = layouts.map((l) => ({ ...l, updatedAt: now }))
    await db.layouts.bulkPut(records)
  }
}
