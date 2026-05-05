import { readBlobAsArrayBuffer } from '@/utils/blob'

export interface IndexedDbBlobFallback {
  __stecuteBlobFallback: 'array-buffer'
  type: string
  data: ArrayBuffer
}

export type IndexedDbBlobValue = Blob | IndexedDbBlobFallback

function isIndexedDbBlobFallback(value: unknown): value is IndexedDbBlobFallback {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    (value as IndexedDbBlobFallback).__stecuteBlobFallback === 'array-buffer' &&
    (value as IndexedDbBlobFallback).data instanceof ArrayBuffer
  )
}

function getErrorText(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name} ${error.message}`
  }

  if (error && typeof error === 'object') {
    const details = error as { name?: unknown; message?: unknown }
    return `${String(details.name ?? '')} ${String(details.message ?? '')}`.trim()
  }

  return String(error)
}

function shouldRetryBlobAsArrayBuffer(error: unknown): boolean {
  return /Blob\/File data|DataCloneError|could not be cloned/i.test(getErrorText(error))
}

function shouldPreferArrayBufferStorage(): boolean {
  return true
}

async function createArrayBufferFallback(blob: Blob): Promise<IndexedDbBlobFallback> {
  return {
    __stecuteBlobFallback: 'array-buffer',
    type: blob.type,
    data: await readBlobAsArrayBuffer(blob),
  }
}

export function restoreIndexedDbBlob(value: IndexedDbBlobValue): Blob {
  if (value instanceof Blob) {
    return value
  }

  if (isIndexedDbBlobFallback(value)) {
    return new Blob([new Uint8Array(value.data.slice(0))], { type: value.type })
  }

  throw new Error('Stored image data is not readable.')
}

export async function writeBlobWithFallback<T>(
  blob: Blob,
  write: (blob: Blob) => Promise<T>,
): Promise<T> {
  if (shouldPreferArrayBufferStorage()) {
    return write((await createArrayBufferFallback(blob)) as unknown as Blob)
  }

  try {
    return await write(blob)
  } catch (error) {
    if (!shouldRetryBlobAsArrayBuffer(error)) {
      throw error
    }

    return write((await createArrayBufferFallback(blob)) as unknown as Blob)
  }
}
