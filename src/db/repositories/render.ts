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
    await writeBlobWithFallback(render.blob, (blob) =>
      db.renders.add({ ...render, blob, id, sizeBytes }),
    )
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

  async delete(id: string): Promise<void> {
    await db.renders.delete(id)
  }

  async deleteOldRenders(keepCount: number = GALLERY_RETENTION_LIMIT): Promise<Render[]> {
    const allRenders = await db.renders.orderBy('createdAt').reverse().toArray()
    const toDelete = allRenders.slice(keepCount)

    if (toDelete.length > 0) {
      await db.renders.bulkDelete(toDelete.map((render) => render.id))
    }

    return toDelete
  }

  async clearAll(): Promise<void> {
    await db.renders.clear()
  }
}
