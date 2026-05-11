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
  return (window as Window & { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker
}

export function detectOutputCapabilities(): OutputCapabilities {
  return {
    canDownload: true, // Always available via <a download>
    canSave: !!getSaveFilePicker(),
    canShare: !!navigator.share,
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
      blob.type === 'image/jpeg' ? { 'image/jpeg': ['.jpg'] } : { 'image/png': ['.png'] }
    const handle = await saveFilePicker({
      suggestedName: filename,
      types: [
        {
          description: 'Photo Strip',
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
  const printWindow = window.open(url, '_blank')
  if (!printWindow) {
    URL.revokeObjectURL(url)
    return false
  }
  printWindow.onload = () => {
    printWindow.print()
    URL.revokeObjectURL(url)
  }
  return true
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
