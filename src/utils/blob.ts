export function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer().catch(() => readBlobWithFileReader(blob))
  }

  return readBlobWithFileReader(blob)
}

function readBlobWithFileReader(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result)
        return
      }

      reject(new Error('File data is not readable.'))
    }

    reader.onerror = () => {
      reject(reader.error ?? new Error('File data is not readable.'))
    }

    reader.readAsArrayBuffer(blob)
  })
}
