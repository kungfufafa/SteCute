import type { TemplateConfig } from '@/db/schema'

export const boothmansTemplate: TemplateConfig = {
  id: 'boothmans-strip',
  name: 'Boothmans',
  description: 'Blanko karakter dari sample lokal untuk layout 3 foto.',
  background: '#f7d6d6',
  surfaceColor: '#f7d6d6',
  accentColor: '#d66f8a',
  textColor: '#5f2d35',
  preview: {
    thumbnailImage: '/templates/1777041071745-IMG_1107.png',
    background: '#f7d6d6',
  },
  blanko: {
    mode: 'image',
    backgroundImage: '/templates/1777041071745-IMG_1107.png',
    imageLayer: 'overlay',
    imageFit: 'stretch',
    pattern: 'paper',
    photoPadding: 0,
    photoRadius: 0,
    photoShadow: false,
  },
  supportedLayoutIds: ['strip-3-vertical'],
  layoutOverrides: {
    'strip-3-vertical': {
      canvas: { width: 1200, height: 3602 },
      slots: [
        { x: 72, y: 329, width: 1056, height: 707, radius: 0 },
        { x: 72, y: 1202, width: 1056, height: 707, radius: 0 },
        { x: 72, y: 2076, width: 1056, height: 705, radius: 0 },
      ],
    },
  },
  frameAsset: '',
  defaultFrameColor: '#f7d6d6',
  label: {
    text: '',
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
