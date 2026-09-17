import { isAcceptedUploadType } from '@/services/upload'

export const CUSTOM_BACKGROUND_MAX_BYTES = 10 * 1024 * 1024

export type VirtualBackgroundMode = 'off' | 'color' | 'blur' | 'custom'

export interface VirtualBackgroundConfig {
  id: string
  label: string
  description: string
  mode: VirtualBackgroundMode
  color?: string
  previewBackground: string
}

export const VIRTUAL_BACKGROUNDS: VirtualBackgroundConfig[] = [
  {
    id: 'off',
    label: 'Asli',
    description: 'Biarkan latar ruangan apa adanya.',
    mode: 'off',
    previewBackground: 'linear-gradient(135deg, #f8fafc 0%, #cbd5e1 52%, #0f172a 100%)',
  },
  {
    id: 'pink',
    label: 'Pink',
    description: 'Latar studio solid pink.',
    mode: 'color',
    color: '#f472b6',
    previewBackground: '#f472b6',
  },
  {
    id: 'blue',
    label: 'Biru',
    description: 'Latar studio solid biru.',
    mode: 'color',
    color: '#38bdf8',
    previewBackground: '#38bdf8',
  },
  {
    id: 'lilac',
    label: 'Ungu',
    description: 'Latar studio solid ungu.',
    mode: 'color',
    color: '#c084fc',
    previewBackground: '#c084fc',
  },
  {
    id: 'mint',
    label: 'Mint',
    description: 'Latar studio solid mint.',
    mode: 'color',
    color: '#2dd4bf',
    previewBackground: '#2dd4bf',
  },
  {
    id: 'cream',
    label: 'Krem',
    description: 'Latar studio solid krem.',
    mode: 'color',
    color: '#fde68a',
    previewBackground: '#fde68a',
  },
  {
    id: 'white',
    label: 'Putih',
    description: 'Latar studio solid putih.',
    mode: 'color',
    color: '#f8fafc',
    previewBackground: '#f8fafc',
  },
  {
    id: 'blur',
    label: 'Blur',
    description: 'Samarkan ruangan asli, biarkan orang tetap tajam.',
    mode: 'blur',
    previewBackground: 'linear-gradient(135deg, #e2e8f0 0%, #94a3b8 48%, #334155 100%)',
  },
  {
    id: 'custom',
    label: 'Gambar',
    description: 'Unggah JPG, PNG, atau WebP lokal (maks. 10 MB) jadi latar.',
    mode: 'custom',
    previewBackground: 'linear-gradient(135deg, #fff7ed 0%, #fdba74 50%, #be123c 100%)',
  },
]

const BACKGROUND_BY_ID = new Map(
  VIRTUAL_BACKGROUNDS.map((background) => [background.id, background]),
)

export interface CustomBackgroundValidation {
  valid: boolean
  errors: string[]
}

export function getVirtualBackgroundById(
  backgroundId?: string | null,
): VirtualBackgroundConfig {
  return BACKGROUND_BY_ID.get(backgroundId ?? '') ?? VIRTUAL_BACKGROUNDS[0]
}

export function normalizeVirtualBackgroundId(backgroundId?: string | null): string {
  return getVirtualBackgroundById(backgroundId).id
}

export function isVirtualBackgroundActive(backgroundId?: string | null): boolean {
  return getVirtualBackgroundById(backgroundId).mode !== 'off'
}

export function parseBackgroundColor(color: string): [number, number, number] {
  const hex = color.trim().replace('#', '')
  if (hex.length === 3) {
    return [
      Number.parseInt(hex[0] + hex[0], 16),
      Number.parseInt(hex[1] + hex[1], 16),
      Number.parseInt(hex[2] + hex[2], 16),
    ]
  }

  if (hex.length >= 6) {
    return [
      Number.parseInt(hex.slice(0, 2), 16),
      Number.parseInt(hex.slice(2, 4), 16),
      Number.parseInt(hex.slice(4, 6), 16),
    ]
  }

  return [248, 250, 252]
}

export function validateCustomBackgroundFile(
  file: Pick<File, 'name' | 'type' | 'size'>,
): CustomBackgroundValidation {
  const errors: string[] = []

  if (!isAcceptedUploadType(file)) {
    errors.push(`"${file.name}" bukan format yang didukung. Gunakan JPG, PNG, atau WebP.`)
  }

  if (file.size > CUSTOM_BACKGROUND_MAX_BYTES) {
    errors.push(`"${file.name}" melebihi batas ukuran 10 MB.`)
  }

  return { valid: errors.length === 0, errors }
}
