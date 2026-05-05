import Dexie, { type EntityTable } from 'dexie'

// --- Types ---

export interface AppSetting {
  key: string
  value: unknown
  updatedAt: number
}

export interface Session {
  id: string
  status: 'idle' | 'completed' | 'discarded'
  captureSource: 'camera' | 'upload'
  layoutId: string
  templateId: string
  slotCount: number
  decorationConfig: DecorationConfig
  startedAt: number
  completedAt: number | null
  finalRenderId: string | null
}

export interface DecorationConfig {
  filterId: string
  frameColor: string
  selectedStickerIds: string[]
  showDateTime: boolean
  logoText: string
}

export interface Shot {
  id: string
  sessionId: string
  order: number
  sourceType: 'camera' | 'upload'
  blob: Blob
  width: number
  height: number
  createdAt: number
}

export interface Render {
  id: string
  sessionId: string
  mimeType: 'image/png' | 'image/jpeg'
  variant: 'default' | 'print' | 'share'
  blob: Blob
  width: number
  height: number
  sizeBytes: number
  createdAt: number
  savedToDeviceAt: number | null
}

export interface LayoutConfig {
  id: string
  name: string
  slotCount: number
  printFormat: {
    id: string
    label: string
    paperSize: string
    description: string
    fileSlug: string
  }
  canvas: { width: number; height: number }
  slots: SlotConfig[]
}

export interface SlotConfig {
  x: number
  y: number
  width: number
  height: number
  radius: number
}

export interface LayoutRecord {
  id: string
  name: string
  slotCount: number
  aspectRatio: string
  config: LayoutConfig
  isBundled: boolean
  updatedAt: number
}

export interface TemplateRecord {
  id: string
  name: string
  version: string
  config: TemplateConfig
  isBundled: boolean
  assetBlob?: Blob
  updatedAt: number
}

export interface TemplateConfig {
  id: string
  name: string
  description?: string
  background: string
  surfaceColor: string
  accentColor: string
  textColor: string
  preview?: {
    background?: string
    thumbnailImage?: string
  }
  blanko: {
    mode: 'generated' | 'image'
    backgroundImage: string | null
    imageLayer?: 'background' | 'overlay'
    imageFit?: 'cover' | 'contain' | 'stretch'
    pattern: 'paper' | 'gingham' | 'mono'
    photoPadding: number
    photoRadius: number
    photoShadow: boolean
  }
  nativeLayout?: LayoutConfig
  supportedLayoutIds?: string[]
  layoutOverrides?: Record<
    string,
    {
      canvas: { width: number; height: number }
      slots: SlotConfig[]
    }
  >
  frameAsset: string
  defaultFrameColor: string
  label: {
    text: string
    fontSize: number
    align: 'left' | 'center' | 'right'
  }
  footerLogo: string | null
  supports: {
    stickers: boolean
    frameColor: boolean
    dateTime: boolean
    logoText: boolean
  }
}

export interface AssetRecord {
  id: string
  type: 'frame' | 'sticker' | 'overlay' | 'filter-preview'
  name: string
  path: string
  packId: string
  isBundled: boolean
  updatedAt: number
}

export interface EventPreset {
  id: string
  name: string
  layoutId: string
  templateId: string
  decorationConfig: DecorationConfig
  autoResetEnabled: boolean
  updatedAt: number
}

// --- Database ---

class StecuteDB extends Dexie {
  appSettings!: EntityTable<AppSetting, 'key'>
  sessions!: EntityTable<Session, 'id'>
  shots!: EntityTable<Shot, 'id'>
  renders!: EntityTable<Render, 'id'>
  layouts!: EntityTable<LayoutRecord, 'id'>
  templates!: EntityTable<TemplateRecord, 'id'>
  assets!: EntityTable<AssetRecord, 'id'>
  eventPresets!: EntityTable<EventPreset, 'id'>

  constructor() {
    super('stecute-db')

    this.version(1).stores({
      appSettings: 'key',
      sessions: 'id, status, captureSource, layoutId, startedAt',
      shots: 'id, sessionId, order',
      renders: 'id, sessionId, createdAt',
      layouts: 'id, slotCount',
      templates: 'id',
      assets: 'id, type, packId',
      eventPresets: 'id',
    })

    this.version(2).stores({
      appSettings: 'key',
      sessions: 'id, status, captureSource, layoutId, startedAt',
      shots: 'id, sessionId, order, [sessionId+order]',
      renders: 'id, sessionId, createdAt',
      layouts: 'id, slotCount',
      templates: 'id',
      assets: 'id, type, packId',
      eventPresets: 'id',
    })
  }
}

export const db = new StecuteDB()
