import type { TemplateConfig } from '@/db/schema'

export const youthTemplate: TemplateConfig = {
  id: 'youth',
  name: 'Youth',
  background: '#fce4ec',
  frameAsset: '/assets/frames/youth.png',
  defaultFrameColor: '#f48fb1',
  label: {
    text: 'stecute',
    fontSize: 40,
    align: 'center',
  },
  supports: {
    stickers: true,
    frameColor: true,
    dateTime: true,
    logoText: true,
  },
}
