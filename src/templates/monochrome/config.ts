import type { TemplateConfig } from '@/db/schema'

export const monoTemplate: TemplateConfig = {
  id: 'mono',
  name: 'Mono',
  background: '#212121',
  surfaceColor: '#303030',
  accentColor: '#e0e0e0',
  textColor: '#f5f5f5',
  blanko: {
    mode: 'generated',
    backgroundImage: null,
    pattern: 'mono',
    photoPadding: 8,
    photoRadius: 8,
    photoShadow: true,
  },
  frameAsset: '/assets/frames/mono.png',
  defaultFrameColor: '#303030',
  label: {
    text: 'stecute',
    fontSize: 36,
    align: 'center',
  },
  footerLogo: null,
  supports: {
    stickers: false,
    frameColor: false,
    dateTime: false,
    logoText: false,
  },
}
