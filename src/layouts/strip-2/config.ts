import type { LayoutConfig } from '@/db/schema'

export const strip2Config: LayoutConfig = {
  id: 'strip-2-vertical',
  name: '2 Foto',
  slotCount: 2,
  printFormat: {
    id: '2x6-mini-strip',
    label: '2 Foto',
    paperSize: '2x6 in',
    description: 'Ukuran 2x6',
    fileSlug: '2x6-mini-strip',
  },
  canvas: { width: 1200, height: 3600 },
  slots: [
    { x: 150, y: 180, width: 900, height: 1560, radius: 20 },
    { x: 150, y: 1860, width: 900, height: 1560, radius: 20 },
  ],
}
