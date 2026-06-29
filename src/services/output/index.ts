export type OutputAction = 'download' | 'save' | 'share' | 'print'

export interface OutputCapabilities {
  canDownload: boolean
  canSave: boolean
  canShare: boolean
  canPrint: boolean
}

interface SaveFilePickerOptions {
  suggestedName: string
  types: Array<{
    description: string
    accept: Record<string, string[]>
  }>
}

interface SaveWritable {
  write(data: Blob): Promise<void>
  close(): Promise<void>
}

interface SaveFileHandle {
  createWritable(): Promise<SaveWritable>
}

type SaveFilePicker = (options: SaveFilePickerOptions) => Promise<SaveFileHandle>

function getSaveFilePicker(): SaveFilePicker | undefined {
  if (typeof window === 'undefined') return undefined

  return (window as Window & { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker
}

function canShareImageFiles(): boolean {
  if (typeof navigator === 'undefined' || !navigator.share || typeof File === 'undefined') {
    return false
  }

  if (!navigator.canShare) return true

  try {
    const testFile = new File([new Blob([''])], 'stecute-share-test.png', { type: 'image/png' })
    return navigator.canShare({ files: [testFile] })
  } catch {
    return false
  }
}

export function detectOutputCapabilities(): OutputCapabilities {
  return {
    canDownload: true, // Always available via <a download>
    canSave: !!getSaveFilePicker(),
    canShare: canShareImageFiles(),
    canPrint: typeof window !== 'undefined' && !!window.print,
  }
}

export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function saveBlob(blob: Blob, filename: string): Promise<boolean> {
  const saveFilePicker = getSaveFilePicker()

  if (!saveFilePicker) return false

  try {
    const accept: Record<string, string[]> =
      blob.type === 'image/jpeg'
        ? { 'image/jpeg': ['.jpg'] }
        : blob.type.startsWith('video/')
          ? { [blob.type || 'video/webm']: [`.${getExtensionForMimeType(blob.type)}`] }
          : { 'image/png': ['.png'] }
    const handle = await saveFilePicker({
      suggestedName: filename,
      types: [
        {
          description: blob.type.startsWith('video/') ? 'Live Cam Strip' : 'Photo Strip',
          accept,
        },
      ],
    })
    const writable = await handle.createWritable()
    await writable.write(blob)
    await writable.close()
    return true
  } catch {
    return false
  }
}

export async function shareBlob(blob: Blob, filename: string): Promise<boolean> {
  if (!navigator.share) return false

  try {
    const file = new File([blob], filename, { type: blob.type })
    if (navigator.canShare && !navigator.canShare({ files: [file] })) return false

    await navigator.share({
      files: [file],
      title: 'Stecute Strip',
    })
    return true
  } catch {
    return false
  }
}

export function printBlob(blob: Blob): boolean {
  const url = URL.createObjectURL(blob)
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    URL.revokeObjectURL(url)
    return false
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Print Strip</title>
        <style>
          @media print {
            body { margin: 0; padding: 0; background: none; }
            img { max-width: 100%; height: auto; }
            .warning { display: none; }
          }
          body { text-align: center; background: #fff; font-family: sans-serif; margin: 0; padding: 20px; }
          .warning { padding: 15px; color: #854d0e; background: #fefce8; border: 1px solid #fef08a; border-radius: 8px; font-size: 14px; margin-bottom: 20px; max-width: 600px; margin-left: auto; margin-right: auto; }
          img { max-width: 100%; height: auto; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        </style>
      </head>
      <body>
        <div class="warning">
          Pastikan opsi <strong>Background graphics</strong> aktif pada dialog print jika hasil terlihat kosong.
        </div>
        <img src="${url}" onload="setTimeout(() => { window.print(); window.close(); }, 500);" />
      </body>
    </html>
  `)
  printWindow.document.close()
  return true
}

export function getExtensionForMimeType(mimeType: string): string {
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/png') return 'png'
  if (mimeType.includes('mp4')) return 'mp4'
  if (mimeType.includes('webm')) return 'webm'

  return 'bin'
}

function getLayoutFileSlug(layoutId: string): string {
  if (layoutId === 'strip-2-vertical') return '2x6-mini-strip'
  if (layoutId === 'strip-3-vertical') return '2x6-tall-strip'
  if (layoutId === 'strip-4-vertical') return '2x6-classic-strip'
  if (layoutId === 'strip-6-vertical') return '2x6-6photo-strip'

  return layoutId.replace('strip-', '').replace('-vertical', '').replace('-grid', '')
}

export function generateFilename(layoutId: string, templateId: string, ext: string): string {
  const now = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  const layout = getLayoutFileSlug(layoutId)
  return `stecute-${date}-${time}-${layout}-${templateId}.${ext}`
}
