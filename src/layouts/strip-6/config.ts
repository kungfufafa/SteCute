import type { LayoutConfig } from '@/db/schema'

export const strip6Config: LayoutConfig = {
  id: 'strip-6-vertical',
  name: '6 Foto',
  slotCount: 6,
  printFormat: {
    id: '2x6-6photo-strip',
    label: '6 Foto',
    paperSize: '2x6 in',
    description: 'Strip penuh',
    fileSlug: '2x6-6photo-strip',
  },
  canvas: { width: 1200, height: 5230 },
  slots: [
    { x: 60, y: 60, width: 1080, height: 810, radius: 0 },
    { x: 60, y: 890, width: 1080, height: 810, radius: 0 },
    { x: 60, y: 1720, width: 1080, height: 810, radius: 0 },
    { x: 60, y: 2550, width: 1080, height: 810, radius: 0 },
    { x: 60, y: 3380, width: 1080, height: 810, radius: 0 },
    { x: 60, y: 4210, width: 1080, height: 810, radius: 0 },
  ],
}
