import { afterEach, describe, expect, it, vi } from 'vitest'
import { openHiddenFilePicker } from '@/utils/file-picker'

type Handler = EventListenerOrEventListenerObject

function asHandler(handler: Handler) {
  return typeof handler === 'function' ? handler : handler.handleEvent
}

function installPickerDom() {
  const documentListeners = new Map<string, Handler[]>()
  const windowListeners = new Map<string, Handler[]>()
  const inputListeners = new Map<string, Handler[]>()
  const filesRef: { current: FileList | null } = { current: null }

  const input = {
    type: '',
    accept: '',
    multiple: false,
    style: {} as Record<string, string>,
    files: null as FileList | null,
    click: vi.fn(),
    remove: vi.fn(),
    setAttribute: vi.fn(),
    addEventListener(type: string, handler: Handler) {
      inputListeners.set(type, [...(inputListeners.get(type) ?? []), handler])
    },
    get filesValue() {
      return filesRef.current
    },
  }

  Object.defineProperty(input, 'files', {
    get() {
      return filesRef.current
    },
    set(value: FileList | null) {
      filesRef.current = value
    },
    configurable: true,
  })

  const documentMock = {
    body: { appendChild: vi.fn() },
    createElement: vi.fn(() => input),
    addEventListener(type: string, handler: Handler) {
      documentListeners.set(type, [...(documentListeners.get(type) ?? []), handler])
    },
    removeEventListener(type: string, handler: Handler) {
      documentListeners.set(
        type,
        (documentListeners.get(type) ?? []).filter((item) => item !== handler),
      )
    },
  }

  const windowMock = {
    addEventListener(type: string, handler: Handler) {
      windowListeners.set(type, [...(windowListeners.get(type) ?? []), handler])
    },
    removeEventListener(type: string, handler: Handler) {
      windowListeners.set(
        type,
        (windowListeners.get(type) ?? []).filter((item) => item !== handler),
      )
    },
    setTimeout: globalThis.setTimeout.bind(globalThis),
  }

  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: documentMock,
  })
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: windowMock,
  })

  return {
    input,
    filesRef,
    emitInput(type: string) {
      for (const handler of inputListeners.get(type) ?? []) asHandler(handler).call(input, new Event(type))
    },
    emitWindow(type: string) {
      for (const handler of windowListeners.get(type) ?? []) {
        asHandler(handler).call(windowMock, new Event(type))
      }
    },
  }
}

function fakeFiles(): FileList {
  const file = new File(['strip'], 'one.jpg', { type: 'image/jpeg' })
  return {
    0: file,
    length: 1,
    item: (index: number) => (index === 0 ? file : null),
    [Symbol.iterator]: function* () {
      yield file
    },
  } as FileList
}

describe('hidden file picker', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps a later change event even if the window focused first', async () => {
    const dom = installPickerDom()
    const result = openHiddenFilePicker({ accept: 'image/jpeg', multiple: false })

    dom.emitWindow('focus')
    dom.filesRef.current = fakeFiles()
    dom.emitInput('change')

    await expect(result).resolves.toMatchObject({ length: 1 })
  })

  it('does not treat focus alone as cancel', async () => {
    vi.useFakeTimers()
    const dom = installPickerDom()
    let settled: FileList | null | 'pending' = 'pending'
    void openHiddenFilePicker({ accept: 'image/jpeg', multiple: false }).then((files) => {
      settled = files
    })

    dom.emitWindow('focus')
    await vi.advanceTimersByTimeAsync(2_000)
    expect(settled).toBe('pending')
  })
})
