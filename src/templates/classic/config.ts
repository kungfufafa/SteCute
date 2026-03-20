import type { TemplateConfig } from '@/db/schema'

export const classicTemplate: TemplateConfig = {
  id: 'classic',
  name: 'Classic',
  background: '#fffdf8',
  frameAsset: '/assets/frames/classic.png',
  defaultFrameColor: '#ffffff',
  label: {
    text: 'stecute',
    fontSize: 36,
    align: 'center',
  },
  supports: {
    stickers: true,
    frameColor: true,
    dateTime: true,
    logoText: true,
  },
}
