import type { LayoutConfig } from '@/db/schema'

export const strip3Config: LayoutConfig = {
  id: 'strip-3-vertical',
  name: '3 Foto',
  slotCount: 3,
  printFormat: {
    id: 'fit-3-photo-strip',
    label: '3 Foto',
    paperSize: 'Fit 3 foto',
    description: 'Kertas sedang',
    fileSlug: 'fit-3-photo-strip',
  },
  canvas: { width: 1200, height: 2740 },
  slots: [
    { x: 60, y: 60, width: 1080, height: 810, radius: 0 },
    { x: 60, y: 890, width: 1080, height: 810, radius: 0 },
    { x: 60, y: 1720, width: 1080, height: 810, radius: 0 },
  ],
}
