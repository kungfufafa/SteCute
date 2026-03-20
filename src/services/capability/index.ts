export interface BrowserCapabilities {
  isSecureContext: boolean
  hasMediaDevices: boolean
  hasGetUserMedia: boolean
  hasCamera: boolean
  hasShare: boolean
  hasSaveFilePicker: boolean
  hasOffscreenCanvas: boolean
  hasCreateImageBitmap: boolean
  hasServiceWorker: boolean
  hasIndexedDB: boolean
}

export function detectCapabilities(): BrowserCapabilities {
  return {
    isSecureContext: window.isSecureContext,
    hasMediaDevices: 'mediaDevices' in navigator,
    hasGetUserMedia: typeof navigator.mediaDevices?.getUserMedia === 'function',
    hasCamera: typeof navigator.mediaDevices?.getUserMedia === 'function',
    hasShare: 'share' in navigator,
    hasSaveFilePicker: 'showSaveFilePicker' in window,
    hasOffscreenCanvas: typeof OffscreenCanvas !== 'undefined',
    hasCreateImageBitmap: typeof createImageBitmap === 'function',
    hasServiceWorker: 'serviceWorker' in navigator,
    hasIndexedDB: 'indexedDB' in window,
  }
}

export function isBrowserSupported(caps: BrowserCapabilities): boolean {
  return caps.hasMediaDevices && caps.hasGetUserMedia && caps.hasIndexedDB
}

export function getUnsupportedReasons(caps: BrowserCapabilities): string[] {
  const reasons: string[] = []
  if (!caps.hasMediaDevices) reasons.push('MediaDevices API not available')
  if (!caps.hasGetUserMedia) reasons.push('Camera access not available')
  if (!caps.hasIndexedDB) reasons.push('Local storage not available')
  return reasons
}
