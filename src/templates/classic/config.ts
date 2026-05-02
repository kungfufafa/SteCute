import type { TemplateConfig } from '@/db/schema'

export const classicTemplate: TemplateConfig = {
  id: 'classic',
  name: 'Classic',
  background: '#ffffff',
  surfaceColor: '#ffffff',
  accentColor: '#111111',
  textColor: '#111111',
  blanko: {
    mode: 'generated',
    backgroundImage: null,
    pattern: 'paper',
    photoPadding: 0,
    photoRadius: 0,
    photoShadow: false,
  },
  frameAsset: '/assets/frames/classic.png',
  defaultFrameColor: '#ffffff',
  label: {
    text: '',
    fontSize: 104,
    align: 'center',
  },
  footerLogo: '/icons.svg',
  supports: {
    stickers: false,
    frameColor: false,
    dateTime: false,
    logoText: false,
  },
}
