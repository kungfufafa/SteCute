export interface FilterConfig {
  id: string
  name: string
  cssFilter: string
  previewPath: string
}

export const FILTERS: FilterConfig[] = [
  {
    id: 'normal',
    name: 'Normal',
    cssFilter: 'none',
    previewPath: '/assets/filters/previews/normal.webp',
  },
  {
    id: 'bw',
    name: 'B&W',
    cssFilter: 'grayscale(100%)',
    previewPath: '/assets/filters/previews/bw.webp',
  },
  {
    id: 'warm',
    name: 'Warm',
    cssFilter: 'sepia(30%) saturate(140%) brightness(105%)',
    previewPath: '/assets/filters/previews/warm.webp',
  },
  {
    id: 'cool',
    name: 'Cool',
    cssFilter: 'saturate(80%) hue-rotate(10deg) brightness(105%)',
    previewPath: '/assets/filters/previews/cool.webp',
  },
  {
    id: 'vintage',
    name: 'Vintage',
    cssFilter: 'sepia(40%) contrast(90%) brightness(95%) saturate(80%)',
    previewPath: '/assets/filters/previews/vintage.webp',
  },
  {
    id: 'fade',
    name: 'Fade',
    cssFilter: 'contrast(85%) brightness(110%) saturate(80%)',
    previewPath: '/assets/filters/previews/fade.webp',
  },
  {
    id: 'film',
    name: 'Film',
    cssFilter: 'contrast(110%) saturate(85%) brightness(95%) sepia(10%)',
    previewPath: '/assets/filters/previews/film.webp',
  },
  {
    id: 'rosy',
    name: 'Rosy',
    cssFilter: 'sepia(15%) saturate(130%) brightness(105%) hue-rotate(-10deg)',
    previewPath: '/assets/filters/previews/rosy.webp',
  },
]

export function getFilterById(id: string): FilterConfig | undefined {
  return FILTERS.find((f) => f.id === id)
}

export const FRAME_COLORS = [
  { id: 'white', value: '#ffffff', name: 'White' },
  { id: 'cream', value: '#fff8e1', name: 'Cream' },
  { id: 'pink', value: '#f48fb1', name: 'Pink' },
  { id: 'blue', value: '#64b5f6', name: 'Blue' },
  { id: 'gray', value: '#9e9e9e', name: 'Gray' },
  { id: 'dark', value: '#424242', name: 'Dark' },
  { id: 'black', value: '#000000', name: 'Black' },
  { id: 'gold', value: '#ffd54f', name: 'Gold' },
]

export const STICKER_CATEGORIES = [
  { id: 'shapes', name: 'Shapes', count: 4 },
  { id: 'stars', name: 'Stars & Sparkles', count: 4 },
  { id: 'hearts', name: 'Hearts', count: 2 },
  { id: 'flowers', name: 'Flowers', count: 2 },
  { id: 'speech', name: 'Speech & Doodles', count: 2 },
  { id: 'celebration', name: 'Celebration', count: 2 },
] as const
