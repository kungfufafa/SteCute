import type { FaceBounds } from '@/services/face-tracking'

const LOCAL_CAMERA_EFFECT_ASSET_URLS = {
  hearts: {
    small: new URL('../../assets/camera-effects/hearts/smallHeart.png', import.meta.url).href,
    medium: new URL('../../assets/camera-effects/hearts/mediumHeart.png', import.meta.url).href,
    large: new URL('../../assets/camera-effects/hearts/largeHeart.png', import.meta.url).href,
  },
  birds: {
    small: [
      new URL('../../assets/camera-effects/bluebirds/birdSmall0.png', import.meta.url).href,
      new URL('../../assets/camera-effects/bluebirds/birdSmall1.png', import.meta.url).href,
      new URL('../../assets/camera-effects/bluebirds/birdSmall2.png', import.meta.url).href,
      new URL('../../assets/camera-effects/bluebirds/birdSmall3.png', import.meta.url).href,
    ],
    medium: [
      new URL('../../assets/camera-effects/bluebirds/birdMedium0.png', import.meta.url).href,
      new URL('../../assets/camera-effects/bluebirds/birdMedium1.png', import.meta.url).href,
      new URL('../../assets/camera-effects/bluebirds/birdMedium2.png', import.meta.url).href,
      new URL('../../assets/camera-effects/bluebirds/birdMedium3.png', import.meta.url).href,
    ],
    large: [
      new URL('../../assets/camera-effects/bluebirds/birdLarge0.png', import.meta.url).href,
      new URL('../../assets/camera-effects/bluebirds/birdLarge1.png', import.meta.url).href,
      new URL('../../assets/camera-effects/bluebirds/birdLarge2.png', import.meta.url).href,
      new URL('../../assets/camera-effects/bluebirds/birdLarge3.png', import.meta.url).href,
    ],
  },
} as const

const KICAU_MANIA_ASSET_URLS = Object.entries(
  import.meta.glob<string>('../../assets/camera-effects/kicau-mania/kicauMania*.png', {
    eager: true,
    import: 'default',
    query: '?url',
  }),
)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([, url]) => url)

const WINDUT_ASSET_URLS = Object.entries(
  import.meta.glob<string>('../../assets/camera-effects/windut/windut*.png', {
    eager: true,
    import: 'default',
    query: '?url',
  }),
)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([, url]) => url)

const KICAU_MANIA_FRAME_DURATIONS_MS = [
  90, 195, 90, 90, 195, 90, 90, 195, 90, 90, 195, 90, 90, 105, 180, 90, 105, 180, 90, 105, 180, 90,
  105, 180, 90, 105, 180, 90, 105, 180, 90, 105, 180, 90, 105, 180, 90, 105, 180, 90, 105, 180, 90,
  105, 180, 90, 105, 180, 90, 105, 180, 90, 105,
] as const

const KICAU_MANIA_SOURCE_LOOP_MS = KICAU_MANIA_FRAME_DURATIONS_MS.reduce(
  (total, duration) => total + duration,
  0,
)
const WINDUT_FRAME_DURATION_MS = 100
const WINDUT_SOURCE_LOOP_MS = Math.max(
  WINDUT_FRAME_DURATION_MS,
  WINDUT_ASSET_URLS.length * WINDUT_FRAME_DURATION_MS,
)
const WINDUT_DIZZY_ORBIT_COUNT = 2

export interface CameraEffectConfig {
  id: string
  label: string
  description: string
  previewBackground: string
  /** When true, this effect uses face detection to position overlays per-face */
  faceTracking?: boolean
}

export const CAMERA_EFFECTS: CameraEffectConfig[] = [
  {
    id: 'none',
    label: 'Tanpa',
    description: 'Tidak memakai overlay tambahan.',
    previewBackground: 'linear-gradient(135deg, #f8fafc 0%, #fda4af 55%, #0f172a 100%)',
  },
  {
    id: 'hearts',
    label: 'Hati',
    description: 'Banyak hati pink tipis yang melayang rapi di area atas foto.',
    previewBackground: 'linear-gradient(135deg, #fff1f2 0%, #f472b6 52%, #be123c 100%)',
    faceTracking: true,
  },
  {
    id: 'bluebirds',
    label: 'Burung',
    description: 'Deretan burung biru kecil melayang di atas kepala seperti Photo Booth.',
    previewBackground: 'linear-gradient(135deg, #ecfeff 0%, #38bdf8 52%, #1d4ed8 100%)',
    faceTracking: true,
  },
  {
    id: 'kicau-mania',
    label: 'Kicau Mania',
    description: 'Kucing scuba dance yang loncat kecil di area atas foto.',
    previewBackground: 'linear-gradient(135deg, #ecfeff 0%, #22d3ee 46%, #ec4899 100%)',
    faceTracking: true,
  },
  {
    id: 'windut',
    label: 'Windut',
    description: 'Windut kecil berputar di atas kepala seperti efek pusing.',
    previewBackground: 'linear-gradient(135deg, #fff7ed 0%, #fb7185 48%, #1f2937 100%)',
    faceTracking: true,
  },
]

type CameraEffectContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

interface EffectDrawOptions {
  timeMs?: number
}

interface EffectMark {
  dx: number
  dy: number
  size: number
  rotate?: number
  alpha?: number
  phase?: number
}

export type CameraEffectAssetKey =
  | 'heart-small'
  | 'heart-medium'
  | 'heart-large'
  | 'bird-small-0'
  | 'bird-small-1'
  | 'bird-small-2'
  | 'bird-small-3'
  | 'bird-medium-0'
  | 'bird-medium-1'
  | 'bird-medium-2'
  | 'bird-medium-3'
  | 'bird-large-0'
  | 'bird-large-1'
  | 'bird-large-2'
  | 'bird-large-3'
  | `kicau-mania-${number}`
  | `windut-${number}`

export type PhotoBoothAssetKey = CameraEffectAssetKey

export interface CameraEffectAsset {
  key: CameraEffectAssetKey
  url: string
}

interface LoadedCameraEffectAsset {
  source: CanvasImageSource
  width: number
  height: number
}

export const CAMERA_EFFECT_LOOP_MS = 2400

const EFFECT_BY_ID = new Map(CAMERA_EFFECTS.map((effect) => [effect.id, effect]))
const HEART_ASSETS: CameraEffectAsset[] = [
  { key: 'heart-small', url: LOCAL_CAMERA_EFFECT_ASSET_URLS.hearts.small },
  { key: 'heart-medium', url: LOCAL_CAMERA_EFFECT_ASSET_URLS.hearts.medium },
  { key: 'heart-large', url: LOCAL_CAMERA_EFFECT_ASSET_URLS.hearts.large },
]
const BIRD_ASSETS = {
  small: LOCAL_CAMERA_EFFECT_ASSET_URLS.birds.small.map((url, index) => ({
    key: `bird-small-${index}` as CameraEffectAssetKey,
    url,
  })),
  medium: LOCAL_CAMERA_EFFECT_ASSET_URLS.birds.medium.map((url, index) => ({
    key: `bird-medium-${index}` as CameraEffectAssetKey,
    url,
  })),
  large: LOCAL_CAMERA_EFFECT_ASSET_URLS.birds.large.map((url, index) => ({
    key: `bird-large-${index}` as CameraEffectAssetKey,
    url,
  })),
}
const KICAU_MANIA_ASSETS: CameraEffectAsset[] = KICAU_MANIA_ASSET_URLS.map((url, index) => ({
  key: `kicau-mania-${index}` as CameraEffectAssetKey,
  url,
}))
const WINDUT_ASSETS: CameraEffectAsset[] = WINDUT_ASSET_URLS.map((url, index) => ({
  key: `windut-${index}` as CameraEffectAssetKey,
  url,
}))
const loadedAssets = new Map<CameraEffectAssetKey, LoadedCameraEffectAsset | null>()
const loadingAssets = new Map<CameraEffectAssetKey, Promise<LoadedCameraEffectAsset | null>>()

export function getCameraEffectById(effectId?: string | null): CameraEffectConfig {
  return EFFECT_BY_ID.get(effectId ?? '') ?? CAMERA_EFFECTS[0]
}

export function normalizeCameraEffectId(effectId?: string | null): string {
  return getCameraEffectById(effectId).id
}

/**
 * Check if the given effect ID requires face tracking.
 */
export function isFaceTrackingEffect(effectId?: string | null): boolean {
  const effect = getCameraEffectById(effectId)
  return effect.faceTracking === true
}

export function getCameraEffectLoopMs(effectId?: string | null): number {
  return normalizeCameraEffectId(effectId) === 'windut'
    ? WINDUT_SOURCE_LOOP_MS
    : CAMERA_EFFECT_LOOP_MS
}

export function normalizeCameraEffectFrameMs(timeMs = 0, effectId?: string | null): number {
  const loopMs = getCameraEffectLoopMs(effectId)
  return ((timeMs % loopMs) + loopMs) % loopMs
}

function isRenderableFaceBounds(face: FaceBounds): boolean {
  return (
    Number.isFinite(face.x) &&
    Number.isFinite(face.y) &&
    Number.isFinite(face.width) &&
    Number.isFinite(face.height) &&
    face.width > 0 &&
    face.height > 0
  )
}

export function resolveFaceTrackingEffectFaces(
  faceBounds?: FaceBounds[] | null,
  fallbackSize?: { width: number; height: number },
): FaceBounds[] {
  const detectedFaces = (faceBounds ?? []).filter(isRenderableFaceBounds)

  if (detectedFaces.length > 0) {
    return detectedFaces
  }

  if (fallbackSize) {
    return estimateFaceBoundsForStaticRender(fallbackSize.width, fallbackSize.height)
  }

  return []
}

export function getCameraEffectAssetManifest(effectId?: string | null): CameraEffectAsset[] {
  const normalizedEffectId = normalizeCameraEffectId(effectId)

  if (normalizedEffectId === 'hearts') return HEART_ASSETS
  if (normalizedEffectId === 'bluebirds')
    return [...BIRD_ASSETS.small, ...BIRD_ASSETS.medium, ...BIRD_ASSETS.large]
  if (normalizedEffectId === 'kicau-mania') return [...KICAU_MANIA_ASSETS]
  if (normalizedEffectId === 'windut') return [...WINDUT_ASSETS]

  return []
}

export async function preloadCameraEffectAssets(effectId?: string | null): Promise<void> {
  const assets = getCameraEffectAssetManifest(effectId)
  if (assets.length === 0) return

  await Promise.all(assets.map((asset) => loadCameraEffectAsset(asset)))
}

async function loadCameraEffectAsset(
  asset: CameraEffectAsset,
): Promise<LoadedCameraEffectAsset | null> {
  const existing = loadedAssets.get(asset.key)
  if (existing) return existing
  if (loadedAssets.has(asset.key)) return null

  const currentLoad = loadingAssets.get(asset.key)
  if (currentLoad) return currentLoad

  const load = loadCanvasImageSource(asset.url)
    .catch((error) => {
      console.warn(`Failed to load camera overlay asset ${asset.key}:`, error)
      return null
    })
    .then((image) => {
      loadedAssets.set(asset.key, image)
      loadingAssets.delete(asset.key)
      return image
    })

  loadingAssets.set(asset.key, load)
  return load
}

async function loadCanvasImageSource(url: string): Promise<LoadedCameraEffectAsset | null> {
  if (typeof fetch === 'function' && typeof createImageBitmap === 'function') {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const bitmap = await createImageBitmap(await response.blob())
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
    }
  }

  if (typeof Image !== 'undefined') {
    const image = new Image()
    image.decoding = 'async'
    image.src = url

    if (typeof image.decode === 'function') {
      await image.decode()
    } else {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error(`Could not load ${url}`))
      })
    }

    return {
      source: image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
    }
  }

  return null
}

function getLoadedCameraEffectAsset(
  key: CameraEffectAssetKey,
): LoadedCameraEffectAsset | undefined {
  return loadedAssets.get(key) ?? undefined
}

function drawEffectImage(ctx: CameraEffectContext, image: LoadedCameraEffectAsset, width: number) {
  const height = width * (image.height / image.width)
  ctx.drawImage(image.source, -width / 2, -height / 2, width, height)
}

function getHeartAsset(displayWidth: number): LoadedCameraEffectAsset | undefined {
  if (displayWidth <= 52) return getLoadedCameraEffectAsset('heart-small')
  if (displayWidth <= 76) return getLoadedCameraEffectAsset('heart-medium')
  return getLoadedCameraEffectAsset('heart-large')
}

function getBirdAsset(
  displayWidth: number,
  wingPhase: number,
): LoadedCameraEffectAsset | undefined {
  const normalizedPhase = ((wingPhase % 1) + 1) % 1
  const frameIndex = Math.floor(normalizedPhase * 4) % 4

  if (displayWidth <= 62)
    return getLoadedCameraEffectAsset(`bird-small-${frameIndex}` as CameraEffectAssetKey)
  if (displayWidth <= 86)
    return getLoadedCameraEffectAsset(`bird-medium-${frameIndex}` as CameraEffectAssetKey)
  return getLoadedCameraEffectAsset(`bird-large-${frameIndex}` as CameraEffectAssetKey)
}

function getKicauManiaAsset(frameProgress: number): LoadedCameraEffectAsset | undefined {
  const normalizedProgress = ((frameProgress % 1) + 1) % 1
  const sourceTimeMs = normalizedProgress * KICAU_MANIA_SOURCE_LOOP_MS
  let frameIndex = 0
  let elapsedMs = 0

  for (let index = 0; index < KICAU_MANIA_FRAME_DURATIONS_MS.length; index += 1) {
    elapsedMs += KICAU_MANIA_FRAME_DURATIONS_MS[index]
    if (sourceTimeMs <= elapsedMs) {
      frameIndex = index
      break
    }
  }

  return getLoadedCameraEffectAsset(`kicau-mania-${frameIndex}` as CameraEffectAssetKey)
}

function getWindutAsset(timeMs: number): LoadedCameraEffectAsset | undefined {
  if (WINDUT_ASSETS.length === 0) return undefined

  const sourceTimeMs = normalizeCameraEffectFrameMs(timeMs, 'windut')
  const frameIndex =
    Math.floor(sourceTimeMs / WINDUT_FRAME_DURATION_MS) % Math.max(1, WINDUT_ASSETS.length)

  return getLoadedCameraEffectAsset(`windut-${frameIndex}` as CameraEffectAssetKey)
}

export function drawCameraEffect(
  _ctx: CameraEffectContext,
  _width: number,
  _height: number,
  effectId?: string | null,
  options: EffectDrawOptions = {},
): void {
  const normalizedEffectId = normalizeCameraEffectId(effectId)
  if (normalizedEffectId === 'none') return

  normalizeCameraEffectFrameMs(options.timeMs, normalizedEffectId)
}

function drawHeart(ctx: CameraEffectContext, x: number, y: number, size: number) {
  const half = size / 2

  ctx.beginPath()
  ctx.moveTo(x, y + half * 0.28)
  ctx.bezierCurveTo(x, y - half * 0.64, x - size, y - half * 0.1, x, y + size)
  ctx.bezierCurveTo(x + size, y - half * 0.1, x, y - half * 0.64, x, y + half * 0.28)
  ctx.closePath()
  ctx.fill()
}

function drawStickerHeart(ctx: CameraEffectContext, size: number, shine = 1) {
  const displayWidth = size * 1.9
  const heartAsset = getHeartAsset(displayWidth)

  if (heartAsset) {
    ctx.save()
    ctx.globalAlpha *= 0.9 * shine
    ctx.shadowColor = 'rgba(190, 18, 60, 0.16)'
    ctx.shadowBlur = size * 0.18
    drawEffectImage(ctx, heartAsset, displayWidth)
    ctx.restore()
    return
  }

  ctx.save()
  ctx.globalAlpha *= 0.7 * shine
  ctx.fillStyle = '#ec2d75'
  drawHeart(ctx, 0, 0, size)

  ctx.globalAlpha *= 0.32
  ctx.fillStyle = '#f9a8d4'
  drawHeart(ctx, -size * 0.16, -size * 0.1, size * 0.45)
  ctx.restore()
}

function drawFourPointStar(ctx: CameraEffectContext, x: number, y: number, radius: number) {
  ctx.beginPath()
  ctx.moveTo(x, y - radius)
  ctx.quadraticCurveTo(x + radius * 0.14, y - radius * 0.14, x + radius, y)
  ctx.quadraticCurveTo(x + radius * 0.14, y + radius * 0.14, x, y + radius)
  ctx.quadraticCurveTo(x - radius * 0.14, y + radius * 0.14, x - radius, y)
  ctx.quadraticCurveTo(x - radius * 0.14, y - radius * 0.14, x, y - radius)
  ctx.closePath()
  ctx.fill()
}

function drawBlueBird(ctx: CameraEffectContext, size: number, wingPhase = 0) {
  const displayWidth = size * 2.05
  const birdAsset = getBirdAsset(displayWidth, wingPhase)

  if (birdAsset) {
    ctx.save()
    ctx.shadowColor = 'rgba(14, 116, 144, 0.24)'
    ctx.shadowBlur = size * 0.16
    drawEffectImage(ctx, birdAsset, displayWidth)
    ctx.restore()
    return
  }

  const wingLift = Math.sin(wingPhase * Math.PI * 2)
  const wingOpen = 0.5 + wingLift * 0.5
  const bodyGradient = ctx.createLinearGradient(-size * 0.62, -size * 0.34, size * 0.7, size * 0.32)
  bodyGradient.addColorStop(0, '#7dd3fc')
  bodyGradient.addColorStop(0.42, '#38bdf8')
  bodyGradient.addColorStop(1, '#0284c7')

  ctx.save()
  ctx.shadowColor = 'rgba(14, 116, 144, 0.24)'
  ctx.shadowBlur = size * 0.16

  ctx.fillStyle = bodyGradient
  ctx.beginPath()
  ctx.ellipse(0, 0, size * 0.68, size * 0.35, -0.05, 0, Math.PI * 2)
  ctx.fill()

  ctx.globalAlpha = 0.42
  ctx.fillStyle = '#e0f2fe'
  ctx.beginPath()
  ctx.ellipse(size * 0.08, size * 0.1, size * 0.3, size * 0.14, -0.04, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  const wingGradient = ctx.createLinearGradient(
    -size * 0.45,
    -size * 0.32,
    size * 0.24,
    size * 0.18,
  )
  wingGradient.addColorStop(0, '#e0f2fe')
  wingGradient.addColorStop(0.55, '#7dd3fc')
  wingGradient.addColorStop(1, '#0ea5e9')
  ctx.fillStyle = wingGradient
  ctx.save()
  ctx.translate(-size * 0.1, -size * 0.05)
  ctx.rotate(-0.32 - wingLift * 0.46)
  ctx.beginPath()
  ctx.ellipse(
    0,
    -wingOpen * size * 0.1,
    size * (0.36 + wingOpen * 0.1),
    size * 0.18,
    0,
    0,
    Math.PI * 2,
  )
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.globalAlpha = 0.5
  ctx.fillStyle = '#bae6fd'
  ctx.translate(size * 0.08, size * 0.01)
  ctx.rotate(0.18 + wingLift * 0.24)
  ctx.beginPath()
  ctx.ellipse(0, wingOpen * size * 0.04, size * 0.28, size * 0.12, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  ctx.fillStyle = '#0ea5e9'
  ctx.beginPath()
  ctx.ellipse(size * 0.48, -size * 0.2, size * 0.24, size * 0.2, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.globalAlpha = 0.72
  ctx.fillStyle = '#bae6fd'
  ctx.beginPath()
  ctx.ellipse(size * 0.4, -size * 0.25, size * 0.08, size * 0.05, -0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  ctx.fillStyle = '#0284c7'
  ctx.beginPath()
  ctx.moveTo(-size * 0.54, -size * 0.02)
  ctx.lineTo(-size * 0.96, -size * 0.18)
  ctx.lineTo(-size * 0.84, size * 0.16)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#0369a1'
  ctx.beginPath()
  ctx.moveTo(-size * 0.58, size * 0.02)
  ctx.lineTo(-size * 1.02, size * 0.02)
  ctx.lineTo(-size * 0.84, size * 0.24)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#fb923c'
  ctx.beginPath()
  ctx.moveTo(size * 0.68, -size * 0.2)
  ctx.lineTo(size * 1.02, -size * 0.1)
  ctx.lineTo(size * 0.68, size * 0.02)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#0f172a'
  ctx.beginPath()
  ctx.arc(size * 0.55, -size * 0.24, size * 0.035, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(size * 0.565, -size * 0.255, size * 0.012, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

function drawKicauManiaSprite(ctx: CameraEffectContext, size: number, frameProgress = 0) {
  const displayWidth = size * 3.35
  const birdAsset = getKicauManiaAsset(frameProgress)

  if (birdAsset) {
    ctx.save()
    ctx.shadowColor = 'rgba(8, 145, 178, 0.2)'
    ctx.shadowBlur = size * 0.18
    drawEffectImage(ctx, birdAsset, displayWidth)
    ctx.restore()
    return
  }

  drawBlueBird(ctx, size, frameProgress)
}

function drawWindutSprite(ctx: CameraEffectContext, size: number, timeMs: number) {
  const displayWidth = size * 2.35
  const windutAsset = getWindutAsset(timeMs)

  if (windutAsset) {
    ctx.save()
    ctx.shadowColor = 'rgba(15, 23, 42, 0.22)'
    ctx.shadowBlur = size * 0.18
    drawEffectImage(ctx, windutAsset, displayWidth)
    ctx.restore()
    return
  }

  ctx.save()
  ctx.globalAlpha *= 0.78
  ctx.fillStyle = '#fb7185'
  drawFourPointStar(ctx, 0, 0, size * 0.7)
  ctx.restore()
}

function drawHeartEcho(ctx: CameraEffectContext, size: number, opacity: number) {
  const displayWidth = size * 2.05
  const heartAsset = getHeartAsset(displayWidth)

  if (heartAsset) {
    ctx.save()
    ctx.globalAlpha = opacity
    drawEffectImage(ctx, heartAsset, displayWidth)
    ctx.restore()
    return
  }

  ctx.save()
  ctx.globalAlpha = opacity
  ctx.fillStyle = '#f9a8d4'
  drawHeart(ctx, 0, 0, size)
  ctx.restore()
}

/**
 * Estimate likely face positions for static renders where MediaPipe isn't available.
 * Uses a simple heuristic: assumes a face is centered horizontally
 * in the upper third of the photo frame.
 */
export function estimateFaceBoundsForStaticRender(width: number, height: number): FaceBounds[] {
  const faceWidth = 0.35
  const faceHeight = faceWidth * (width / height) * 1.2
  return [
    {
      x: 0.5 - faceWidth / 2,
      y: 0.12,
      width: faceWidth,
      height: Math.min(faceHeight, 0.45),
    },
  ]
}

/**
 * Draw a face-tracking effect for all detected faces.
 * The coordinates in `faces` are normalized (0–1).
 */
export function drawFaceTrackingEffect(
  ctx: CameraEffectContext,
  width: number,
  height: number,
  effectId: string,
  faces: FaceBounds[],
  options: EffectDrawOptions = {},
): void {
  const renderableFaces = faces.filter(isRenderableFaceBounds)
  if (renderableFaces.length === 0) return

  const frameMs = normalizeCameraEffectFrameMs(options.timeMs, effectId)

  for (const [faceIndex, face] of renderableFaces.entries()) {
    const faceX = face.x * width
    const faceY = face.y * height
    const faceW = face.width * width
    const centerX = faceX + faceW / 2
    const idleBob = Math.sin(
      ((frameMs / CAMERA_EFFECT_LOOP_MS + faceIndex * 0.17) % 1) * Math.PI * 2,
    )
    const topY = faceY + idleBob * faceW * 0.018

    ctx.save()

    if (effectId === 'ft-crown') drawCrown(ctx, centerX, topY, faceW, frameMs)
    else if (effectId === 'ft-cat') drawCatEars(ctx, centerX, topY, faceW, frameMs)
    else if (effectId === 'ft-devil') drawDevilHorns(ctx, centerX, topY, faceW, frameMs)
    else if (effectId === 'ft-halo') drawHaloRing(ctx, centerX, topY, faceW, frameMs)
    else if (effectId === 'ft-flower') drawFlowerCrown(ctx, centerX, topY, faceW, frameMs)
    else if (effectId === 'hearts') drawFaceHearts(ctx, centerX, topY, faceW, frameMs)
    else if (effectId === 'bluebirds') drawFaceBirds(ctx, centerX, topY, faceW, frameMs)
    else if (effectId === 'kicau-mania') drawFaceKicauMania(ctx, centerX, topY, faceW, frameMs)
    else if (effectId === 'windut') drawFaceWindut(ctx, centerX, topY, faceW, frameMs)
    else if (effectId === 'sparkles') drawFaceSparkles(ctx, centerX, topY, faceW, frameMs)

    ctx.restore()
  }
}

function drawCrown(
  ctx: CameraEffectContext,
  cx: number,
  topY: number,
  faceW: number,
  timeMs: number,
) {
  const shimmer = phasePulse(timeMs, 0.18)
  const tilt = phaseWave(timeMs, 0.38) * 0.035
  const crownW = faceW * 0.8
  const crownH = faceW * 0.35
  const baseY = topY - crownH * 0.2
  const left = cx - crownW / 2

  ctx.save()
  ctx.translate(cx, baseY - crownH * 0.45)
  ctx.rotate(tilt)
  ctx.translate(-cx, -(baseY - crownH * 0.45))

  ctx.shadowColor = 'rgba(217, 119, 6, 0.35)'
  ctx.shadowBlur = crownW * (0.1 + shimmer * 0.08)

  // Main crown body
  const grad = (ctx as CanvasRenderingContext2D).createLinearGradient?.(
    left,
    baseY - crownH,
    left,
    baseY,
  )
  if (grad) {
    grad.addColorStop(0, '#fbbf24')
    grad.addColorStop(0.5, '#f59e0b')
    grad.addColorStop(1, '#d97706')
    ctx.fillStyle = grad
  } else {
    ctx.fillStyle = '#f59e0b'
  }

  ctx.beginPath()
  ctx.moveTo(left, baseY)
  ctx.lineTo(left, baseY - crownH * 0.65)
  ctx.lineTo(left + crownW * 0.15, baseY - crownH * 0.4)
  ctx.lineTo(left + crownW * 0.3, baseY - crownH)
  ctx.lineTo(left + crownW * 0.5, baseY - crownH * 0.55)
  ctx.lineTo(left + crownW * 0.7, baseY - crownH)
  ctx.lineTo(left + crownW * 0.85, baseY - crownH * 0.4)
  ctx.lineTo(left + crownW, baseY - crownH * 0.65)
  ctx.lineTo(left + crownW, baseY)
  ctx.closePath()
  ctx.fill()

  // Crown band
  ctx.fillStyle = '#92400e'
  ctx.globalAlpha = 0.35
  ctx.fillRect(left, baseY - crownH * 0.12, crownW, crownH * 0.12)
  ctx.globalAlpha = 1

  // Jewels
  const gemSize = crownW * 0.055
  const gemColors = ['#ef4444', '#3b82f6', '#ef4444']
  const gemPositions = [0.3, 0.5, 0.7]
  for (let i = 0; i < gemColors.length; i++) {
    ctx.fillStyle = gemColors[i]
    ctx.beginPath()
    ctx.arc(left + crownW * gemPositions[i], baseY - crownH * 0.5, gemSize, 0, Math.PI * 2)
    ctx.fill()
    const sparkle = phasePulse(timeMs, i * 0.22)
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.beginPath()
    ctx.arc(
      left + crownW * gemPositions[i] - gemSize * 0.25,
      baseY - crownH * 0.5 - gemSize * 0.25,
      gemSize * (0.26 + sparkle * 0.28),
      0,
      Math.PI * 2,
    )
    ctx.fill()
  }

  ctx.restore()
}

function drawCatEars(
  ctx: CameraEffectContext,
  cx: number,
  topY: number,
  faceW: number,
  timeMs: number,
) {
  const earW = faceW * 0.22
  const earH = faceW * 0.35
  const spread = faceW * 0.32
  const baseY = topY + earH * 0.15

  ctx.shadowColor = 'rgba(219, 39, 119, 0.25)'
  ctx.shadowBlur = earW * 0.3

  for (const side of [-1, 1]) {
    const earCx = cx + side * spread
    const earWiggle = phaseWave(timeMs, side > 0 ? 0.28 : 0.46) * 0.07

    ctx.save()
    ctx.translate(earCx, baseY)
    ctx.rotate(side * earWiggle)
    ctx.translate(-earCx, -baseY)
    // Outer ear
    ctx.fillStyle = '#4a4a4a'
    ctx.beginPath()
    ctx.moveTo(earCx - earW / 2, baseY)
    ctx.quadraticCurveTo(earCx - earW * 0.1, baseY - earH, earCx, baseY - earH)
    ctx.quadraticCurveTo(earCx + earW * 0.1, baseY - earH, earCx + earW / 2, baseY)
    ctx.closePath()
    ctx.fill()

    // Inner ear
    ctx.fillStyle = '#f9a8d4'
    ctx.beginPath()
    const innerScale = 0.55
    ctx.moveTo(earCx - (earW * innerScale) / 2, baseY - earH * 0.08)
    ctx.quadraticCurveTo(earCx - earW * 0.06, baseY - earH * 0.82, earCx, baseY - earH * 0.82)
    ctx.quadraticCurveTo(
      earCx + earW * 0.06,
      baseY - earH * 0.82,
      earCx + (earW * innerScale) / 2,
      baseY - earH * 0.08,
    )
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
}

function drawDevilHorns(
  ctx: CameraEffectContext,
  cx: number,
  topY: number,
  faceW: number,
  timeMs: number,
) {
  const glow = phasePulse(timeMs, 0.1)
  const hornH = faceW * 0.42
  const hornW = faceW * 0.12
  const spread = faceW * 0.28
  const baseY = topY + hornH * 0.05

  ctx.shadowColor = 'rgba(153, 27, 27, 0.3)'
  ctx.shadowBlur = hornW * (0.7 + glow * 0.7)

  for (const side of [-1, 1]) {
    const hornCx = cx + side * spread
    const tilt = side * (0.18 + phaseWave(timeMs, side > 0 ? 0.32 : 0.52) * 0.035)

    ctx.save()
    ctx.translate(hornCx, baseY)
    ctx.rotate(tilt)

    // Horn gradient
    const grad = (ctx as CanvasRenderingContext2D).createLinearGradient?.(0, 0, 0, -hornH)
    if (grad) {
      grad.addColorStop(0, '#991b1b')
      grad.addColorStop(0.5, '#dc2626')
      grad.addColorStop(1, '#fca5a5')
      ctx.fillStyle = grad
    } else {
      ctx.fillStyle = '#dc2626'
    }

    ctx.beginPath()
    ctx.moveTo(-hornW / 2, 0)
    ctx.quadraticCurveTo(-hornW * 0.3, -hornH * 0.6, side * hornW * 0.15, -hornH)
    ctx.quadraticCurveTo(hornW * 0.3, -hornH * 0.6, hornW / 2, 0)
    ctx.closePath()
    ctx.fill()

    // Ridges
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'
    ctx.lineWidth = hornW * 0.06
    for (let r = 0.25; r < 0.8; r += 0.18) {
      const ry = -hornH * r
      const rw = hornW * (1 - r * 0.7) * 0.45
      ctx.beginPath()
      ctx.moveTo(-rw, ry)
      ctx.lineTo(rw, ry)
      ctx.stroke()
    }

    ctx.restore()
  }
}

function drawHaloRing(
  ctx: CameraEffectContext,
  cx: number,
  topY: number,
  faceW: number,
  timeMs: number,
) {
  const float = phaseWave(timeMs, 0.1)
  const glow = phasePulse(timeMs, 0.36)
  const ringW = faceW * 0.55
  const ringH = faceW * 0.14
  const ringY = topY - faceW * (0.22 + float * 0.025)

  ctx.shadowColor = 'rgba(250, 204, 21, 0.45)'
  ctx.shadowBlur = ringW * (0.18 + glow * 0.16)

  // Ring fill
  const grad = (ctx as CanvasRenderingContext2D).createRadialGradient?.(
    cx,
    ringY,
    ringW * 0.15,
    cx,
    ringY,
    ringW * 0.6,
  )
  if (grad) {
    grad.addColorStop(0, 'rgba(253, 224, 71, 0.95)')
    grad.addColorStop(1, 'rgba(250, 204, 21, 0.7)')
    ctx.strokeStyle = grad
  } else {
    ctx.strokeStyle = '#fde047'
  }

  ctx.lineWidth = ringH * 0.55
  ctx.lineCap = 'round'

  ctx.save()
  ctx.translate(cx, ringY)
  ctx.rotate(float * 0.025)
  ctx.translate(-cx, -ringY)
  ctx.beginPath()
  ctx.ellipse(cx, ringY, ringW, ringH, 0, 0, Math.PI * 2)
  ctx.stroke()

  // Inner highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'
  ctx.lineWidth = ringH * 0.18
  ctx.beginPath()
  ctx.ellipse(
    cx,
    ringY - ringH * 0.12,
    ringW * 0.85,
    ringH * 0.65,
    0,
    Math.PI * 0.8,
    Math.PI * (2 + glow * 0.38),
  )
  ctx.stroke()
  ctx.restore()
}

function drawFlowerCrown(
  ctx: CameraEffectContext,
  cx: number,
  topY: number,
  faceW: number,
  timeMs: number,
) {
  const flowerSize = faceW * 0.1
  const crownY = topY - faceW * 0.06
  const spread = faceW * 0.5
  const flowerCount = 7

  ctx.shadowColor = 'rgba(192, 38, 211, 0.2)'
  ctx.shadowBlur = flowerSize * 0.5

  const petalColors = ['#f9a8d4', '#c084fc', '#f472b6', '#e879f9', '#fb7185', '#a78bfa', '#f0abfc']
  const centerColors = ['#fde047', '#fbbf24', '#fde68a', '#fcd34d', '#fef08a', '#fde047', '#fbbf24']

  for (let i = 0; i < flowerCount; i++) {
    const t = i / (flowerCount - 1)
    const fx = cx + (t - 0.5) * spread * 2
    const sway = phaseWave(timeMs, i * 0.13) * faceW * 0.018
    const fy = crownY - Math.sin(t * Math.PI) * faceW * 0.12 + sway
    const bloom = phasePulse(timeMs, i * 0.11)
    const size = flowerSize * (0.68 + Math.sin(t * Math.PI) * 0.28 + bloom * 0.08)

    // Petals
    ctx.fillStyle = petalColors[i % petalColors.length]
    ctx.globalAlpha = 0.9
    const petalCount = 5
    for (let p = 0; p < petalCount; p++) {
      const angle = (Math.PI * 2 * p) / petalCount + phaseWave(timeMs, i * 0.09) * 0.08
      const px = fx + Math.cos(angle) * size * 0.55
      const py = fy + Math.sin(angle) * size * 0.55
      ctx.beginPath()
      ctx.arc(px, py, size * 0.38, 0, Math.PI * 2)
      ctx.fill()
    }

    // Center
    ctx.globalAlpha = 1
    ctx.fillStyle = centerColors[i % centerColors.length]
    ctx.beginPath()
    ctx.arc(fx, fy, size * 0.22, 0, Math.PI * 2)
    ctx.fill()
  }

  // Vine
  ctx.globalAlpha = 0.45
  ctx.strokeStyle = '#16a34a'
  ctx.lineWidth = flowerSize * 0.12
  ctx.beginPath()
  ctx.moveTo(cx - spread, crownY)
  ctx.quadraticCurveTo(cx, crownY - faceW * 0.15, cx + spread, crownY)
  ctx.stroke()
  ctx.globalAlpha = 1

  // Small leaves
  ctx.fillStyle = '#22c55e'
  ctx.globalAlpha = 0.65
  for (let i = 0; i < 5; i++) {
    const lx = cx + (i / 4 - 0.5) * spread * 1.6
    const ly = crownY - Math.sin((i / 4) * Math.PI) * faceW * 0.1 + flowerSize * 0.35
    ctx.save()
    ctx.translate(lx, ly)
    ctx.rotate((i % 2 === 0 ? 1 : -1) * 0.4)
    ctx.beginPath()
    ctx.ellipse(0, 0, flowerSize * 0.18, flowerSize * 0.08, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  ctx.globalAlpha = 1
}

function phaseWave(timeMs: number, phase = 0): number {
  const progress = (timeMs / CAMERA_EFFECT_LOOP_MS + phase) % 1
  return Math.sin(progress * Math.PI * 2)
}

function phasePulse(timeMs: number, phase = 0): number {
  return (phaseWave(timeMs, phase) + 1) / 2
}

function drawFaceHearts(
  ctx: CameraEffectContext,
  cx: number,
  topY: number,
  faceW: number,
  timeMs: number,
) {
  const marks: EffectMark[] = [
    { dx: -0.55, dy: -0.08, size: 0.18, rotate: -0.18, alpha: 0.82, phase: 0.02 },
    { dx: -0.32, dy: -0.03, size: 0.14, rotate: 0.12, alpha: 0.88, phase: 0.18 },
    { dx: -0.12, dy: -0.12, size: 0.2, rotate: -0.05, alpha: 0.9, phase: 0.34 },
    { dx: 0.12, dy: -0.04, size: 0.13, rotate: 0.08, alpha: 0.86, phase: 0.5 },
    { dx: 0.34, dy: -0.1, size: 0.22, rotate: 0.16, alpha: 0.84, phase: 0.66 },
    { dx: 0.55, dy: -0.02, size: 0.16, rotate: -0.1, alpha: 0.78, phase: 0.82 },
    { dx: -0.05, dy: 0.04, size: 0.1, rotate: 0.02, alpha: 0.74, phase: 0.9 },
  ]

  for (const mark of marks) {
    const progress = (timeMs / CAMERA_EFFECT_LOOP_MS + (mark.phase ?? 0)) % 1
    const wave = Math.sin(progress * Math.PI * 2)
    const sideWave = Math.sin((progress * 2 + (mark.phase ?? 0)) * Math.PI * 2)
    const fadeIn = Math.min(1, progress / 0.18)
    const fadeOut = Math.min(1, (1 - progress) / 0.28)
    const opacity = Math.max(0, Math.min(fadeIn, fadeOut))
    const floatY = mark.dy * faceW - progress * faceW * 0.78
    const floatX = mark.dx * faceW + wave * faceW * 0.08 + sideWave * faceW * 0.025
    const scale = 0.74 + progress * 0.34 + phasePulse(timeMs, mark.phase) * 0.08

    ctx.save()
    ctx.translate(cx + floatX, topY + floatY)
    ctx.rotate((mark.rotate ?? 0) + wave * 0.08)
    drawHeartEcho(ctx, faceW * mark.size * 1.2, (mark.alpha ?? 1) * 0.06 * opacity)
    ctx.scale(scale, scale)
    ctx.globalAlpha = (mark.alpha ?? 1) * opacity
    ctx.shadowColor = 'rgba(190, 18, 60, 0.14)'
    ctx.shadowBlur = faceW * 0.018
    drawStickerHeart(ctx, faceW * mark.size, 1)
    ctx.restore()
  }
}

function drawFaceBirds(
  ctx: CameraEffectContext,
  cx: number,
  topY: number,
  faceW: number,
  timeMs: number,
) {
  const orbitMarks = [
    { phase: 0, size: 0.15, radiusX: 0.68, radiusY: 0.17, alpha: 0.9 },
    { phase: 0.14, size: 0.11, radiusX: 0.54, radiusY: 0.13, alpha: 0.66 },
    { phase: 0.3, size: 0.18, radiusX: 0.72, radiusY: 0.18, alpha: 0.94 },
    { phase: 0.46, size: 0.12, radiusX: 0.5, radiusY: 0.12, alpha: 0.7 },
    { phase: 0.62, size: 0.17, radiusX: 0.7, radiusY: 0.17, alpha: 0.9 },
    { phase: 0.8, size: 0.13, radiusX: 0.58, radiusY: 0.14, alpha: 0.74 },
    { phase: 0.88, size: 0.1, radiusX: 0.48, radiusY: 0.11, alpha: 0.62 },
    { phase: 0.94, size: 0.14, radiusX: 0.64, radiusY: 0.16, alpha: 0.82 },
  ]
    .map((mark) => {
      const orbit = (timeMs / (CAMERA_EFFECT_LOOP_MS * 1.18) + mark.phase) % 1
      const angle = orbit * Math.PI * 2
      const depth = (Math.sin(angle) + 1) / 2
      const orbitRadiusX = faceW * mark.radiusX
      const orbitRadiusY = faceW * mark.radiusY
      const velocityX = -Math.sin(angle) * orbitRadiusX
      const velocityY = Math.cos(angle) * orbitRadiusY

      return {
        ...mark,
        x: cx + Math.cos(angle) * orbitRadiusX,
        y: topY - faceW * 0.4 + Math.sin(angle) * orbitRadiusY,
        depth,
        direction: velocityX < 0 ? 1 : -1,
        rotate: Math.max(-0.16, Math.min(0.16, (velocityY / orbitRadiusY) * 0.1)),
        wingPhase: (timeMs / 360 + mark.phase) % 1,
      }
    })
    .sort((a, b) => a.depth - b.depth)

  for (const mark of orbitMarks) {
    const scale = 0.72 + mark.depth * 0.42
    const alpha = mark.alpha * (0.48 + mark.depth * 0.52)

    ctx.save()
    ctx.translate(mark.x, mark.y)
    ctx.rotate(mark.rotate)
    ctx.scale(mark.direction * scale, scale)
    ctx.globalAlpha = alpha
    drawBlueBird(ctx, faceW * mark.size, mark.wingPhase)
    ctx.restore()
  }
}

function drawFaceKicauMania(
  ctx: CameraEffectContext,
  cx: number,
  topY: number,
  faceW: number,
  timeMs: number,
) {
  const danceMarks = [
    { phase: 0, dx: 0, dy: -0.58, size: 0.25, alpha: 0.96, direction: 1 },
    { phase: 0.26, dx: -0.54, dy: -0.4, size: 0.13, alpha: 0.68, direction: -1 },
    { phase: 0.58, dx: 0.54, dy: -0.38, size: 0.13, alpha: 0.68, direction: 1 },
  ]
    .map((mark) => {
      const progress = (timeMs / CAMERA_EFFECT_LOOP_MS + mark.phase) % 1
      const wave = Math.sin(progress * Math.PI * 2)
      const hop = Math.sin(progress * Math.PI * 4)
      const depth = (Math.cos(progress * Math.PI * 2) + 1) / 2

      return {
        ...mark,
        x: cx + mark.dx * faceW + wave * faceW * 0.06,
        y: topY + mark.dy * faceW - Math.abs(hop) * faceW * 0.035,
        rotate: wave * 0.12,
        scale: 0.84 + depth * 0.22,
        frameProgress: (timeMs / CAMERA_EFFECT_LOOP_MS + mark.phase) % 1,
        depth,
      }
    })
    .sort((a, b) => a.depth - b.depth)

  for (const mark of danceMarks) {
    ctx.save()
    ctx.translate(mark.x, mark.y)
    ctx.rotate(mark.rotate)
    ctx.scale(mark.direction * mark.scale, mark.scale)
    ctx.globalAlpha = mark.alpha * (0.62 + mark.depth * 0.38)
    drawKicauManiaSprite(ctx, faceW * mark.size, mark.frameProgress)
    ctx.restore()
  }
}

function drawFaceWindut(
  ctx: CameraEffectContext,
  cx: number,
  topY: number,
  faceW: number,
  timeMs: number,
) {
  const orbitCenterY = Math.max(topY - faceW * 0.18, faceW * 0.16)
  const orbitMarks = [
    { phase: 0, size: 0.112, radiusX: 0.66, radiusY: 0.16, alpha: 0.9, frameOffset: 0 },
    { phase: 0.12, size: 0.09, radiusX: 0.53, radiusY: 0.12, alpha: 0.62, frameOffset: 8 },
    { phase: 0.25, size: 0.12, radiusX: 0.7, radiusY: 0.17, alpha: 0.94, frameOffset: 15 },
    { phase: 0.38, size: 0.094, radiusX: 0.49, radiusY: 0.11, alpha: 0.66, frameOffset: 22 },
    { phase: 0.5, size: 0.116, radiusX: 0.67, radiusY: 0.16, alpha: 0.88, frameOffset: 29 },
    { phase: 0.64, size: 0.096, radiusX: 0.55, radiusY: 0.13, alpha: 0.68, frameOffset: 35 },
    { phase: 0.76, size: 0.122, radiusX: 0.71, radiusY: 0.18, alpha: 0.92, frameOffset: 40 },
    { phase: 0.9, size: 0.086, radiusX: 0.48, radiusY: 0.1, alpha: 0.58, frameOffset: 4 },
  ]
    .map((mark) => {
      const orbit =
        ((timeMs / getCameraEffectLoopMs('windut')) * WINDUT_DIZZY_ORBIT_COUNT + mark.phase) % 1
      const angle = orbit * Math.PI * 2
      const depth = (Math.sin(angle) + 1) / 2
      const orbitRadiusX = faceW * mark.radiusX
      const orbitRadiusY = faceW * mark.radiusY
      const velocityX = -Math.sin(angle) * orbitRadiusX
      const velocityY = Math.cos(angle) * orbitRadiusY

      return {
        ...mark,
        x: cx + Math.cos(angle) * orbitRadiusX,
        y:
          orbitCenterY +
          Math.sin(angle) * orbitRadiusY +
          Math.sin((orbit * 2 + mark.phase) * Math.PI * 2) * faceW * 0.012,
        depth,
        direction: velocityX < 0 ? 1 : -1,
        rotate: Math.max(-0.18, Math.min(0.18, (velocityY / orbitRadiusY) * 0.11)),
        frameMs: timeMs + mark.frameOffset * WINDUT_FRAME_DURATION_MS,
      }
    })
    .sort((a, b) => a.depth - b.depth)

  for (const mark of orbitMarks) {
    const scale = 0.62 + mark.depth * 0.34
    const alpha = mark.alpha * (0.46 + mark.depth * 0.54)

    ctx.save()
    ctx.translate(mark.x, mark.y)
    ctx.rotate(mark.rotate)
    ctx.scale(mark.direction * scale, scale)
    ctx.globalAlpha = alpha
    drawWindutSprite(ctx, faceW * mark.size, mark.frameMs)
    ctx.restore()
  }
}

function drawFaceSparkles(
  ctx: CameraEffectContext,
  cx: number,
  topY: number,
  faceW: number,
  timeMs: number,
) {
  const marks: EffectMark[] = [
    { dx: -0.7, dy: -0.3, size: 0.15, rotate: 0.18, alpha: 0.88, phase: 0.04 },
    { dx: -0.4, dy: -0.7, size: 0.1, rotate: -0.2, alpha: 0.82, phase: 0.3 },
    { dx: 0.1, dy: -0.9, size: 0.18, rotate: 0.28, alpha: 0.9, phase: 0.47 },
    { dx: 0.6, dy: -0.6, size: 0.12, rotate: -0.1, alpha: 0.82, phase: 0.7 },
    { dx: 0.9, dy: -0.2, size: 0.16, rotate: 0.16, alpha: 0.78, phase: 0.88 },
  ]

  for (const mark of marks) {
    const pulse = phasePulse(timeMs, mark.phase)
    const wave = phaseWave(timeMs, mark.phase)
    const glint = phasePulse(timeMs, (mark.phase ?? 0) + 0.2)

    ctx.save()
    ctx.translate(cx + mark.dx * faceW, topY + mark.dy * faceW + wave * faceW * 0.025)
    ctx.rotate((mark.rotate ?? 0) + pulse * 0.5)
    ctx.scale(0.72 + pulse * 0.42, 0.72 + pulse * 0.42)
    ctx.globalAlpha = (mark.alpha ?? 1) * (0.58 + pulse * 0.42)
    ctx.shadowColor = 'rgba(250, 204, 21, 0.3)'
    ctx.shadowBlur = faceW * 0.05
    ctx.fillStyle = '#facc15'
    drawFourPointStar(ctx, 0, 0, faceW * mark.size)
    ctx.globalAlpha = (mark.alpha ?? 1) * glint * 0.55
    ctx.fillStyle = '#fff7ed'
    drawFourPointStar(
      ctx,
      faceW * mark.size * 0.9,
      -faceW * mark.size * 0.8,
      faceW * mark.size * 0.28,
    )
    ctx.globalAlpha = (mark.alpha ?? 1) * (0.2 + glint * 0.35)
    ctx.fillStyle = '#fef3c7'
    ctx.beginPath()
    ctx.arc(
      -faceW * mark.size * 0.78,
      faceW * mark.size * 0.58,
      faceW * mark.size * 0.13,
      0,
      Math.PI * 2,
    )
    ctx.fill()
    ctx.beginPath()
    ctx.arc(
      faceW * mark.size * 0.45,
      faceW * mark.size * 0.72,
      faceW * mark.size * 0.09,
      0,
      Math.PI * 2,
    )
    ctx.fill()
    ctx.restore()
  }
}
