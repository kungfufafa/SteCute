export interface PhotoFilterConfig {
  id: string
  label: string
  cssFilter: string
  canvasFilter: string
  previewBackground: string
}

export const PHOTO_FILTERS: PhotoFilterConfig[] = [
  {
    id: 'normal',
    label: 'Normal',
    cssFilter: 'none',
    canvasFilter: 'none',
    previewBackground: 'linear-gradient(135deg, #f8fafc 0%, #fda4af 55%, #0f172a 100%)',
  },
  {
    id: 'bw',
    label: 'Mono',
    cssFilter: 'grayscale(100%)',
    canvasFilter: 'grayscale(100%)',
    previewBackground: 'linear-gradient(135deg, #f8fafc 0%, #94a3b8 48%, #0f172a 100%)',
  },
  {
    id: 'noir',
    label: 'Noir',
    cssFilter: 'grayscale(100%) contrast(145%) brightness(85%)',
    canvasFilter: 'grayscale(100%) contrast(145%) brightness(85%)',
    previewBackground: 'linear-gradient(135deg, #e5e7eb 0%, #374151 45%, #030712 100%)',
  },
  {
    id: 'warm',
    label: 'Hangat',
    cssFilter: 'sepia(26%) saturate(145%) brightness(106%)',
    canvasFilter: 'sepia(26%) saturate(145%) brightness(106%)',
    previewBackground: 'linear-gradient(135deg, #fff7ed 0%, #fb923c 48%, #be123c 100%)',
  },
  {
    id: 'cool',
    label: 'Sejuk',
    cssFilter: 'saturate(88%) hue-rotate(14deg) brightness(106%)',
    canvasFilter: 'saturate(88%) hue-rotate(14deg) brightness(106%)',
    previewBackground: 'linear-gradient(135deg, #ecfeff 0%, #38bdf8 52%, #4338ca 100%)',
  },
  {
    id: 'vintage',
    label: 'Vintage',
    cssFilter: 'sepia(40%) contrast(90%) brightness(95%) saturate(80%)',
    canvasFilter: 'sepia(40%) contrast(90%) brightness(95%) saturate(80%)',
    previewBackground: 'linear-gradient(135deg, #fef3c7 0%, #d97706 48%, #78350f 100%)',
  },
  {
    id: 'fade',
    label: 'Fade',
    cssFilter: 'contrast(85%) brightness(110%) saturate(80%)',
    canvasFilter: 'contrast(85%) brightness(110%) saturate(80%)',
    previewBackground: 'linear-gradient(135deg, #fff1f2 0%, #c4b5fd 50%, #64748b 100%)',
  },
  {
    id: 'film',
    label: 'Film',
    cssFilter: 'contrast(110%) saturate(85%) brightness(95%) sepia(10%)',
    canvasFilter: 'contrast(110%) saturate(85%) brightness(95%) sepia(10%)',
    previewBackground: 'linear-gradient(135deg, #f8fafc 0%, #64748b 42%, #451a03 100%)',
  },
  {
    id: 'rosy',
    label: 'Rosy',
    cssFilter: 'sepia(15%) saturate(130%) brightness(105%) hue-rotate(-10deg)',
    canvasFilter: 'sepia(15%) saturate(130%) brightness(105%) hue-rotate(-10deg)',
    previewBackground: 'linear-gradient(135deg, #fff1f2 0%, #f472b6 50%, #be123c 100%)',
  },
  {
    id: 'pop',
    label: 'Pop',
    cssFilter: 'contrast(118%) saturate(160%) brightness(105%)',
    canvasFilter: 'contrast(118%) saturate(160%) brightness(105%)',
    previewBackground: 'linear-gradient(135deg, #fefce8 0%, #22c55e 45%, #ec4899 100%)',
  },
  {
    id: 'instant',
    label: 'Instan',
    cssFilter: 'sepia(22%) contrast(96%) saturate(128%) brightness(108%)',
    canvasFilter: 'sepia(22%) contrast(96%) saturate(128%) brightness(108%)',
    previewBackground: 'linear-gradient(135deg, #fffbeb 0%, #f59e0b 46%, #db2777 100%)',
  },
  {
    id: 'dream',
    label: 'Lembut',
    cssFilter: 'contrast(88%) saturate(112%) brightness(116%)',
    canvasFilter: 'contrast(88%) saturate(112%) brightness(116%)',
    previewBackground: 'linear-gradient(135deg, #fdf2f8 0%, #a5b4fc 52%, #14b8a6 100%)',
  },
]

const FILTER_BY_ID = new Map(PHOTO_FILTERS.map((filter) => [filter.id, filter]))

export function getPhotoFilterById(filterId?: string | null): PhotoFilterConfig {
  return FILTER_BY_ID.get(filterId ?? '') ?? PHOTO_FILTERS[0]
}

export function normalizePhotoFilterId(filterId?: string | null): string {
  return getPhotoFilterById(filterId).id
}

export function getPhotoFilterCss(filterId?: string | null): string {
  return getPhotoFilterById(filterId).cssFilter
}

export function getPhotoFilterCanvas(filterId?: string | null): string {
  return getPhotoFilterById(filterId).canvasFilter
}
