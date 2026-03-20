import type { TemplateConfig } from '@/db/schema'

export const monoTemplate: TemplateConfig = {
  id: 'mono',
  name: 'Mono',
  background: '#212121',
  frameAsset: '/assets/frames/mono.png',
  defaultFrameColor: '#424242',
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
