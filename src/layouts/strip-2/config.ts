import type { LayoutConfig } from '@/db/schema'

export const strip2Config: LayoutConfig = {
  id: 'strip-2-vertical',
  name: '2 Foto',
  slotCount: 2,
  printFormat: {
    id: 'fit-2-photo-strip',
    label: '2 Foto',
    paperSize: 'Fit 2 foto',
    description: 'Kertas pendek',
    fileSlug: 'fit-2-photo-strip',
  },
  canvas: { width: 1200, height: 1910 },
  slots: [
    { x: 60, y: 60, width: 1080, height: 810, radius: 0 },
    { x: 60, y: 890, width: 1080, height: 810, radius: 0 },
  ],
}
