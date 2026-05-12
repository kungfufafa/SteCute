type PwaInstallOutcome = 'accepted' | 'dismissed' | 'unavailable'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
}

export interface PwaInstallState {
  installPromptAvailable: boolean
  installedMode: boolean
}

type InstallStateListener = (state: PwaInstallState) => void

let installPromptEvent: BeforeInstallPromptEvent | null = null
const listeners = new Set<InstallStateListener>()

function isIosStandalone() {
  return Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
}

export function isInstalledPwaMode() {
  if (typeof window.matchMedia !== 'function') return isIosStandalone()
  return window.matchMedia('(display-mode: standalone)').matches || isIosStandalone()
}

function getInstallState(): PwaInstallState {
  return {
    installPromptAvailable: installPromptEvent !== null && !isInstalledPwaMode(),
    installedMode: isInstalledPwaMode(),
  }
}

function notifyInstallState() {
  const state = getInstallState()
  listeners.forEach((listener) => listener(state))
}

export function subscribePwaInstallState(listener: InstallStateListener) {
  listeners.add(listener)
  listener(getInstallState())

  return () => {
    listeners.delete(listener)
  }
}

export function bindPwaInstallPrompt() {
  const displayModeQuery =
    typeof window.matchMedia === 'function' ? window.matchMedia('(display-mode: standalone)') : null

  function handleBeforeInstallPrompt(event: Event) {
    event.preventDefault()
    installPromptEvent = event as BeforeInstallPromptEvent
    notifyInstallState()
  }

  function handleAppInstalled() {
    installPromptEvent = null
    notifyInstallState()
  }

  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  window.addEventListener('appinstalled', handleAppInstalled)
  displayModeQuery?.addEventListener?.('change', notifyInstallState)
  notifyInstallState()

  return () => {
    window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.removeEventListener('appinstalled', handleAppInstalled)
    displayModeQuery?.removeEventListener?.('change', notifyInstallState)
  }
}

export async function promptPwaInstall(): Promise<PwaInstallOutcome> {
  if (!installPromptEvent || isInstalledPwaMode()) {
    return 'unavailable'
  }

  const currentPrompt = installPromptEvent
  installPromptEvent = null
  await currentPrompt.prompt()
  const choice = await currentPrompt.userChoice
  notifyInstallState()

  return choice.outcome
}
