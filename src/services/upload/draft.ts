import { restoreIndexedDbBlob, writeBlobWithFallback } from '@/db/blob'
import { db, type AssetRecord } from '@/db/schema'
import { clampUploadImageAdjustment, type UploadImageAdjustment } from './index'

export interface UploadDraftPhoto {
  file: File
  width: number
  height: number
  adjustment: UploadImageAdjustment
}

interface UploadDraftRecord extends AssetRecord {
  type: 'upload-source'
  order: number
  width: number
  height: number
  adjustment: UploadImageAdjustment
}

interface UploadDraftFramingRecord extends AssetRecord {
  type: 'upload-source'
  adjustments: UploadImageAdjustment[]
}

function framingAssetId(sessionId: string): string {
  return `upload-source:${sessionId}:framing`
}

function draftAssetId(sessionId: string, order: number): string {
  return `upload-source:${sessionId}:${order}`
}

async function createDraftRecord(
  sessionId: string,
  order: number,
  photo: UploadDraftPhoto,
): Promise<UploadDraftRecord> {
  return writeBlobWithFallback(photo.file, async (blob) => ({
    id: draftAssetId(sessionId, order),
    type: 'upload-source',
    name: photo.file.name,
    path: '',
    packId: sessionId,
    isBundled: false,
    blob,
    order,
    width: photo.width,
    height: photo.height,
    adjustment: { ...clampUploadImageAdjustment(photo.adjustment) },
    updatedAt: Date.now(),
  }))
}

// Sources share the session's asset lifetime: reset, completed render, and stale cleanup
// remove them together with other session assets. Only URLs belong to the view.
export async function saveUploadDraft(
  sessionId: string,
  photos: UploadDraftPhoto[],
): Promise<void> {
  const records = await Promise.all(
    photos.map((photo, order) => createDraftRecord(sessionId, order, photo)),
  )
  await db.transaction('rw', db.assets, async () => {
    await db.assets
      .where('packId')
      .equals(sessionId)
      .filter((asset) => asset.type === 'upload-source')
      .delete()
    await db.assets.bulkPut(records)
  })
}

export async function saveUploadDraftPhoto(
  sessionId: string,
  order: number,
  photo: UploadDraftPhoto,
): Promise<void> {
  const record = await createDraftRecord(sessionId, order, photo)
  await db.transaction('rw', db.assets, async () => {
    await db.assets.put(record)
    const framing = (await db.assets.get(framingAssetId(sessionId))) as
      | UploadDraftFramingRecord
      | undefined
    if (framing) {
      framing.adjustments[order] = record.adjustment
      framing.updatedAt = Date.now()
      await db.assets.put(framing)
    }
  })
}

export async function updateUploadDraftAdjustments(
  sessionId: string,
  adjustments: UploadImageAdjustment[],
): Promise<void> {
  // Keep frequent drag/zoom writes small instead of cloning every original image again.
  const record: UploadDraftFramingRecord = {
    id: framingAssetId(sessionId),
    type: 'upload-source',
    name: 'Upload framing',
    path: '',
    packId: sessionId,
    isBundled: false,
    adjustments: adjustments.map((adjustment) => ({ ...clampUploadImageAdjustment(adjustment) })),
    updatedAt: Date.now(),
  }
  await db.assets.put(record)
}

export async function loadUploadDraft(
  sessionId: string,
): Promise<Array<UploadDraftPhoto & { order: number }>> {
  const assets = await db.assets.where('packId').equals(sessionId).toArray()
  const framing = assets.find((asset) => asset.id === framingAssetId(sessionId)) as
    | UploadDraftFramingRecord
    | undefined
  return assets
    .filter(
      (asset): asset is UploadDraftRecord =>
        asset.type === 'upload-source' && asset.id !== framingAssetId(sessionId),
    )
    .sort((first, second) => first.order - second.order)
    .map((asset) => {
      if (!asset.blob) throw new Error('Upload source is missing')
      const blob = restoreIndexedDbBlob(asset.blob)
      return {
        order: asset.order,
        file: new File([blob], asset.name, { type: blob.type }),
        width: asset.width,
        height: asset.height,
        adjustment: clampUploadImageAdjustment(
          framing?.adjustments[asset.order] ?? asset.adjustment,
        ),
      }
    })
}
