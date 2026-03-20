import { db, type TemplateRecord, type TemplateConfig } from '../schema'

export class TemplateRepository {
  async getAll(): Promise<TemplateRecord[]> {
    return db.templates.toArray()
  }

  async getById(id: string): Promise<TemplateRecord | undefined> {
    return db.templates.get(id)
  }

  async getTemplateConfig(id: string): Promise<TemplateConfig | undefined> {
    const record = await db.templates.get(id)
    return record?.config
  }

  async upsert(record: Omit<TemplateRecord, 'updatedAt'>): Promise<void> {
    await db.templates.put({ ...record, updatedAt: Date.now() })
  }

  async seed(templates: Omit<TemplateRecord, 'updatedAt'>[]): Promise<void> {
    const now = Date.now()
    const records = templates.map((t) => ({ ...t, updatedAt: now }))
    await db.templates.bulkPut(records)
  }
}
