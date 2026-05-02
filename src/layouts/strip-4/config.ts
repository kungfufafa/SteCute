import type { LayoutConfig } from '@/db/schema'

export const strip4Config: LayoutConfig = {
  id: 'strip-4-vertical',
  name: '4 Foto',
  slotCount: 4,
  printFormat: {
    id: '2x6-classic-strip',
    label: '4 Foto',
    paperSize: '2x6 in',
    description: 'Strip penuh',
    fileSlug: '2x6-classic-strip',
  },
  canvas: { width: 1200, height: 3570 },
  slots: [
    { x: 60, y: 60, width: 1080, height: 810, radius: 0 },
    { x: 60, y: 890, width: 1080, height: 810, radius: 0 },
    { x: 60, y: 1720, width: 1080, height: 810, radius: 0 },
    { x: 60, y: 2550, width: 1080, height: 810, radius: 0 },
  ],
}
