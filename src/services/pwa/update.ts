const HOLD_SESSION_STATUSES = new Set(['capturing', 'uploading', 'reviewing', 'rendering'])

export function shouldHoldPwaUpdate(path: string, sessionStatus?: string | null): boolean {
  if (
    path === '/camera' ||
    path === '/upload' ||
    path === '/review' ||
    path === '/render' ||
    path === '/output' ||
    path === '/booth' ||
    path.startsWith('/j/')
  ) {
    return true
  }

  return Boolean(sessionStatus && HOLD_SESSION_STATUSES.has(sessionStatus))
}
