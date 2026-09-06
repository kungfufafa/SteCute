export function openHiddenFilePicker(options: {
  accept: string
  multiple: boolean
}): Promise<FileList | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null)
      return
    }

    const input = document.createElement('input')
    input.type = 'file'
    input.accept = options.accept
    input.multiple = options.multiple
    input.setAttribute('aria-hidden', 'true')
    input.style.position = 'fixed'
    input.style.left = '-9999px'
    input.style.width = '1px'
    input.style.height = '1px'
    input.style.opacity = '0'
    document.body.appendChild(input)

    let settled = false
    let cancelTimer: ReturnType<typeof setTimeout> | null = null

    const selectedFiles = () => (input.files && input.files.length > 0 ? input.files : null)

    const cleanup = () => {
      window.removeEventListener('focus', handleWindowFocus)
      document.removeEventListener('pointerdown', handleUserGesture, true)
      document.removeEventListener('keydown', handleUserGesture, true)
      if (cancelTimer) {
        clearTimeout(cancelTimer)
        cancelTimer = null
      }
    }

    const finish = (files: FileList | null) => {
      if (settled) return
      settled = true
      cleanup()
      window.setTimeout(() => input.remove(), 0)
      resolve(files)
    }

    const finishIfSelected = () => {
      const files = selectedFiles()
      if (files) finish(files)
      return Boolean(files)
    }

    const scheduleCancelCheck = () => {
      if (settled || cancelTimer) return
      cancelTimer = setTimeout(() => {
        cancelTimer = null
        if (settled) return
        if (finishIfSelected()) return
        finish(null)
      }, 750)
    }

    const handleWindowFocus = () => {
      finishIfSelected()
    }

    const handleUserGesture = () => {
      if (settled) return
      if (finishIfSelected()) return
      scheduleCancelCheck()
    }

    input.addEventListener('cancel', () => {
      if (finishIfSelected()) return
      finish(null)
    })
    input.addEventListener('change', () => finish(selectedFiles()))
    window.addEventListener('focus', handleWindowFocus)
    document.addEventListener('pointerdown', handleUserGesture, true)
    document.addEventListener('keydown', handleUserGesture, true)
    input.click()
  })
}
