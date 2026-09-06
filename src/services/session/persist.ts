const ACTIVE_SESSION_KEY = 'stecute.activeSessionId'
const PENDING_CAMERA_CONFIG_KEY = 'stecute.pendingCameraConfig'
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
    sessionStorage.removeItem(CAMERA_FLOW_KEY)
    sessionStorage.removeItem(PENDING_CAMERA_CONFIG_KEY)
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

export function consumePendingSessionConfig(
  source: PendingSessionSource,
): PendingSessionConfig | null {
  const config = readJson<PendingSessionConfig>(PENDING_CAMERA_CONFIG_KEY)
  if (!config || typeof config.layoutId !== 'string') {
    writeJson(PENDING_CAMERA_CONFIG_KEY, null)
    return null
  }

  const configSource: PendingSessionSource = config.source === 'upload' ? 'upload' : 'camera'
  if (configSource !== source) return null

  writeJson(PENDING_CAMERA_CONFIG_KEY, null)
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
