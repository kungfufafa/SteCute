import { db, type TemplateRecord, type TemplateConfig } from '../schema'
import { restoreIndexedDbBlob, writeBlobWithFallback } from '../blob'

function restoreTemplateBlob(record: TemplateRecord): TemplateRecord {
  if (!record.assetBlob) return record

  return {
    ...record,
    assetBlob: restoreIndexedDbBlob(record.assetBlob),
  }
}

export class TemplateRepository {
  async getAll(): Promise<TemplateRecord[]> {
    const templates = await db.templates.toArray()
    return templates.map(restoreTemplateBlob)
  }

  async getById(id: string): Promise<TemplateRecord | undefined> {
    const template = await db.templates.get(id)
    return template ? restoreTemplateBlob(template) : undefined
  }

  async getTemplateConfig(id: string): Promise<TemplateConfig | undefined> {
    const record = await db.templates.get(id)
    return record?.config
  }

  async upsert(record: Omit<TemplateRecord, 'updatedAt'>): Promise<void> {
    const template = { ...record, updatedAt: Date.now() }

    if (!record.assetBlob) {
      await db.templates.put(template)
      return
    }

    await writeBlobWithFallback(record.assetBlob, (assetBlob) =>
      db.templates.put({ ...template, assetBlob }),
    )
  }

  async seed(templates: Omit<TemplateRecord, 'updatedAt'>[]): Promise<void> {
    await Promise.all(templates.map((template) => this.upsert(template)))
  }
}
