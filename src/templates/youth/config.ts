import type { TemplateConfig } from '@/db/schema'

export const youthTemplate: TemplateConfig = {
  id: 'youth',
  name: 'Youth',
  background: '#fce4ec',
  surfaceColor: '#fff7fb',
  accentColor: '#3b82f6',
  textColor: '#7a1742',
  blanko: {
    mode: 'generated',
    backgroundImage: null,
    pattern: 'gingham',
    photoPadding: 8,
    photoRadius: 8,
    photoShadow: true,
  },
  frameAsset: '/assets/frames/youth.png',
  defaultFrameColor: '#fff7fb',
  label: {
    text: 'stecute',
    fontSize: 40,
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
