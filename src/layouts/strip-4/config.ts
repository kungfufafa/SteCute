import type { LayoutConfig } from '@/db/schema'

export const strip4Config: LayoutConfig = {
  id: 'strip-4-vertical',
  name: '4 Foto',
  slotCount: 4,
  printFormat: {
    id: '2x6-classic-strip',
    label: '4 Foto',
    paperSize: '2x6 in',
    description: 'Ukuran 2x6',
    fileSlug: '2x6-classic-strip',
  },
  canvas: { width: 1200, height: 3600 },
  slots: [
    { x: 150, y: 160, width: 900, height: 760, radius: 20 },
    { x: 150, y: 990, width: 900, height: 760, radius: 20 },
    { x: 150, y: 1820, width: 900, height: 760, radius: 20 },
    { x: 150, y: 2650, width: 900, height: 760, radius: 20 },
  ],
}
