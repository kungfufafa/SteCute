import type { TemplateConfig } from '@/db/schema'

export const youthTemplate: TemplateConfig = {
  id: 'youth',
  name: 'Youth',
  description: 'Pola pastel yang lebih playful untuk sesi santai.',
  background: '#fce4ec',
  surfaceColor: '#fff7fb',
  accentColor: '#3b82f6',
  textColor: '#7a1742',
  preview: {
    background: 'linear-gradient(135deg, #fce4ec 0%, #fff7fb 52%, #dbeafe 100%)',
  },
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
    text: '',
    fontSize: 40,
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
