import type { TemplateConfig } from '@/db/schema'

export const monoTemplate: TemplateConfig = {
  id: 'mono',
  name: 'Mono',
  description: 'Minimal gelap untuk hasil strip yang lebih formal.',
  background: '#212121',
  surfaceColor: '#303030',
  accentColor: '#e0e0e0',
  textColor: '#f5f5f5',
  preview: {
    background: 'linear-gradient(135deg, #212121 0%, #303030 100%)',
  },
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
    text: '',
    fontSize: 36,
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
