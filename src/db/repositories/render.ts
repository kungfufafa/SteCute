import { db, type Render } from '../schema'
import { restoreIndexedDbBlob, writeBlobWithFallback } from '../blob'

export const GALLERY_RETENTION_LIMIT = 10

function restoreRenderBlob(render: Render): Render {
  return { ...render, blob: restoreIndexedDbBlob(render.blob) }
}

export class RenderRepository {
  async create(render: Omit<Render, 'id' | 'sizeBytes'>): Promise<string> {
    const id = crypto.randomUUID()
    const sizeBytes = render.blob.size
    await writeBlobWithFallback(render.blob, (blob) => db.renders.add({ ...render, blob, id, sizeBytes }))
    return id
  }

  async getById(id: string): Promise<Render | undefined> {
    const render = await db.renders.get(id)
    return render ? restoreRenderBlob(render) : undefined
  }

  async getRecent(limit: number = GALLERY_RETENTION_LIMIT): Promise<Render[]> {
    const renders = await db.renders.orderBy('createdAt').reverse().limit(limit).toArray()
    return renders.map(restoreRenderBlob)
  }

  async markSavedToDevice(id: string): Promise<void> {
    await db.renders.update(id, { savedToDeviceAt: Date.now() })
  }

  async delete(id: string): Promise<void> {
    await db.renders.delete(id)
  }

  async deleteOldRenders(keepCount: number = GALLERY_RETENTION_LIMIT): Promise<void> {
    const allIds = await db.renders.orderBy('createdAt').reverse().keys()
    if (allIds.length > keepCount) {
      const toDelete = allIds.slice(keepCount) as string[]
      await db.renders.bulkDelete(toDelete)
    }
  }

  async clearAll(): Promise<void> {
    await db.renders.clear()
  }

  async getStorageEstimate(): Promise<number> {
    let total = 0
    await db.renders.toCollection().each((r) => {
      total += r.sizeBytes
    })
    return total
  }
}
