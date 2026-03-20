import type { LayoutConfig } from '@/db/schema'

export const strip3Config: LayoutConfig = {
  id: 'strip-3-vertical',
  name: '3 Foto',
  slotCount: 3,
  printFormat: {
    id: '2x6-tall-strip',
    label: '3 Foto',
    paperSize: '2x6 in',
    description: 'Ukuran 2x6',
    fileSlug: '2x6-tall-strip',
  },
  canvas: { width: 1200, height: 3600 },
  slots: [
    { x: 150, y: 180, width: 900, height: 1020, radius: 20 },
    { x: 150, y: 1290, width: 900, height: 1020, radius: 20 },
    { x: 150, y: 2400, width: 900, height: 1020, radius: 20 },
  ],
}
