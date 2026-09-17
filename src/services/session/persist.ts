const ACTIVE_SESSION_KEY = 'stecute.activeSessionId'
const PENDING_CAMERA_CONFIG_KEY = 'stecute.pendingCameraConfig'
const PENDING_BOOTH_SETUP_KEY = 'stecute.pendingBoothSetup'
const RETAKE_INDEX_KEY = 'stecute.retakeIndex'
const CAMERA_FLOW_KEY = 'stecute.cameraFlow'

export type PendingSessionSource = 'camera' | 'upload'

export type PendingCameraConfig = {
  layoutId: string
  templateId: string
  slotCount: number
  countdownSeconds: number
  autoCapture: boolean
  source?: PendingSessionSource
}

export type PendingSessionConfig = PendingCameraConfig & {
  source: PendingSessionSource
}

export type StoredCameraFlow = {
  countdownSeconds: number
  autoCapture: boolean
}

export type PendingBoothSetup = {
  code: string
  layoutId: string
  templateId: string
  slotCount: number
  countdownSeconds: number
  autoCapture: boolean
  filterId?: string
  cameraEffectId?: string
  virtualBackgroundId?: string
}

function readJson<T>(key: string): T | null {
  if (typeof sessionStorage === 'undefined') return null

  try {
    const raw = sessionStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof sessionStorage === 'undefined') return

  try {
    if (value == null) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    // sessionStorage can be blocked in private browsing.
  }
}

export function readStoredSessionId(): string | null {
  if (typeof sessionStorage === 'undefined') return null

  try {
    return sessionStorage.getItem(ACTIVE_SESSION_KEY)
  } catch {
    return null
  }
}

export function persistActiveSessionId(id: string | null): void {
  if (typeof sessionStorage === 'undefined') return

  try {
    if (id) {
      sessionStorage.setItem(ACTIVE_SESSION_KEY, id)
      return
    }

    sessionStorage.removeItem(ACTIVE_SESSION_KEY)
    sessionStorage.removeItem(RETAKE_INDEX_KEY)
  } catch {
    // sessionStorage can be blocked in private browsing.
  }
}

export function writePendingCameraConfig(config: PendingCameraConfig): void {
  writePendingSessionConfig({
    ...config,
    source: config.source ?? 'camera',
  })
}

export function writePendingSessionConfig(config: PendingSessionConfig): void {
  writeJson(PENDING_CAMERA_CONFIG_KEY, config)
}

export function clearPendingSessionConfig(): void {
  writeJson(PENDING_CAMERA_CONFIG_KEY, null)
  writeJson(CAMERA_FLOW_KEY, null)
}

function parsePendingSessionConfig(
  config: PendingSessionConfig | null,
): PendingSessionConfig | null {
  if (!config || typeof config.layoutId !== 'string') return null

  const configSource: PendingSessionSource = config.source === 'upload' ? 'upload' : 'camera'

  return {
    layoutId: config.layoutId,
    templateId: typeof config.templateId === 'string' ? config.templateId : 'classic',
    slotCount: typeof config.slotCount === 'number' && config.slotCount > 0 ? config.slotCount : 3,
    countdownSeconds:
      typeof config.countdownSeconds === 'number' && config.countdownSeconds > 0
        ? config.countdownSeconds
        : 3,
    autoCapture: Boolean(config.autoCapture),
    source: configSource,
  }
}

export function readPendingSessionConfig(
  source: PendingSessionSource,
): PendingSessionConfig | null {
  const parsed = parsePendingSessionConfig(readJson<PendingSessionConfig>(PENDING_CAMERA_CONFIG_KEY))
  if (!parsed || parsed.source !== source) return null
  return parsed
}

export function consumePendingSessionConfig(
  source: PendingSessionSource,
): PendingSessionConfig | null {
  const raw = readJson<PendingSessionConfig>(PENDING_CAMERA_CONFIG_KEY)
  const parsed = parsePendingSessionConfig(raw)

  if (!raw || typeof raw.layoutId !== 'string') {
    writeJson(PENDING_CAMERA_CONFIG_KEY, null)
    return null
  }

  if (!parsed || parsed.source !== source) return null

  writeJson(PENDING_CAMERA_CONFIG_KEY, null)
  return parsed
}

export function consumePendingCameraConfig(): PendingCameraConfig | null {
  return consumePendingSessionConfig('camera')
}

export function persistRetakeIndex(index: number | null): void {
  if (index == null || index < 0) {
    writeJson(RETAKE_INDEX_KEY, null)
    return
  }

  writeJson(RETAKE_INDEX_KEY, index)
}

export function readRetakeIndex(): number | null {
  const value = readJson<number>(RETAKE_INDEX_KEY)
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null
}

export function persistCameraFlow(flow: StoredCameraFlow | null): void {
  writeJson(CAMERA_FLOW_KEY, flow)
}

export function readCameraFlow(): StoredCameraFlow | null {
  const flow = readJson<StoredCameraFlow>(CAMERA_FLOW_KEY)
  if (!flow) return null
  if (typeof flow.countdownSeconds !== 'number' || typeof flow.autoCapture !== 'boolean') {
    return null
  }
  return flow
}

function normalizePendingBoothCode(code: string): string {
  return code.trim().replace(/[-\s]/g, '').toUpperCase()
}

function parsePendingBoothSetup(config: PendingBoothSetup | null): PendingBoothSetup | null {
  if (!config || typeof config.code !== 'string' || typeof config.layoutId !== 'string') return null

  const countdownSeconds =
    config.countdownSeconds === 5 || config.countdownSeconds === 10 ? config.countdownSeconds : 3

  return {
    code: config.code,
    layoutId: config.layoutId,
    templateId: typeof config.templateId === 'string' ? config.templateId : 'classic',
    slotCount: typeof config.slotCount === 'number' && config.slotCount > 0 ? config.slotCount : 3,
    countdownSeconds,
    autoCapture: Boolean(config.autoCapture),
    filterId: typeof config.filterId === 'string' ? config.filterId : undefined,
    cameraEffectId: typeof config.cameraEffectId === 'string' ? config.cameraEffectId : undefined,
    virtualBackgroundId:
      typeof config.virtualBackgroundId === 'string' ? config.virtualBackgroundId : undefined,
  }
}

export function writePendingBoothSetup(config: PendingBoothSetup): void {
  const parsed = parsePendingBoothSetup(config)
  if (!parsed) return
  writeJson(PENDING_BOOTH_SETUP_KEY, parsed)
}

export function readPendingBoothSetup(code?: string): PendingBoothSetup | null {
  const parsed = parsePendingBoothSetup(readJson<PendingBoothSetup>(PENDING_BOOTH_SETUP_KEY))
  if (!parsed) return null
  if (code && normalizePendingBoothCode(parsed.code) !== normalizePendingBoothCode(code)) {
    return null
  }
  return parsed
}

export function clearPendingBoothSetup(): void {
  writeJson(PENDING_BOOTH_SETUP_KEY, null)
}
