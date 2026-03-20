import type { LayoutConfig } from '@/db/schema'

export const strip6Config: LayoutConfig = {
  id: 'strip-6-vertical',
  name: '6 Foto',
  slotCount: 6,
  printFormat: {
    id: '2x6-6photo-strip',
    label: '6 Foto',
    paperSize: '2x6 in',
    description: 'Ukuran 2x6',
    fileSlug: '2x6-6photo-strip',
  },
  canvas: { width: 1200, height: 3600 },
  slots: [
    { x: 150, y: 140, width: 900, height: 520, radius: 18 },
    { x: 150, y: 700, width: 900, height: 520, radius: 18 },
    { x: 150, y: 1260, width: 900, height: 520, radius: 18 },
    { x: 150, y: 1820, width: 900, height: 520, radius: 18 },
    { x: 150, y: 2380, width: 900, height: 520, radius: 18 },
    { x: 150, y: 2940, width: 900, height: 520, radius: 18 },
  ],
}
