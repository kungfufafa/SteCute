import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  createMediapipePublicWasmJsPlugin,
  matchMediapipeWasmLoaderFileName,
  wrapMediapipeWasmLoaderSource,
} from '../mediapipe-public-wasm'

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
const simdLoaderPath = `${repoRoot}public/vendor/mediapipe/tasks-vision/wasm/vision_wasm_internal.js`
const simdLoaderSource = readFileSync(simdLoaderPath, 'utf8')

describe('MediaPipe public WASM loader serving', () => {
  it('recognizes bundled wasm factory scripts, including Vite ?import requests', () => {
    expect(
      matchMediapipeWasmLoaderFileName(
        '/vendor/mediapipe/tasks-vision/wasm/vision_wasm_internal.js',
      ),
    ).toBe('vision_wasm_internal.js')
    expect(
      matchMediapipeWasmLoaderFileName(
        '/vendor/mediapipe/tasks-vision/wasm/vision_wasm_internal.js?import',
      ),
    ).toBe('vision_wasm_internal.js')
    expect(
      matchMediapipeWasmLoaderFileName(
        '/vendor/mediapipe/tasks-vision/wasm/vision_wasm_nosimd_internal.js?import&t=1',
      ),
    ).toBe('vision_wasm_nosimd_internal.js')
  })

  it('does not treat wasm binaries, models, or other public scripts as loaders', () => {
    expect(
      matchMediapipeWasmLoaderFileName(
        '/vendor/mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm',
      ),
    ).toBeNull()
    expect(
      matchMediapipeWasmLoaderFileName(
        '/vendor/mediapipe/models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite',
      ),
    ).toBeNull()
    expect(matchMediapipeWasmLoaderFileName('/src/main.ts')).toBeNull()
  })

  it('exposes ModuleFactory on self so module-worker import() can load the UMD factory', () => {
    const wrapped = wrapMediapipeWasmLoaderSource('var ModuleFactory = 1;')
    expect(wrapped).toContain('var ModuleFactory = 1;')
    expect(wrapped).toContain('self.ModuleFactory = ModuleFactory;')
    expect(wrapped).not.toMatch(/export\s+default/)
  })

  it('serves wrapped public wasm factories for Vite transform/import requests', () => {
    const plugin = createMediapipePublicWasmJsPlugin({ root: repoRoot })
    expect(plugin.apply).toBe('serve')
    const loaded = plugin.load?.(
      '/vendor/mediapipe/tasks-vision/wasm/vision_wasm_internal.js?import',
    )

    expect(typeof loaded).toBe('string')
    expect(loaded).toContain(simdLoaderSource.slice(0, 80))
    expect(loaded).toContain('self.ModuleFactory = ModuleFactory;')
    expect(loaded).not.toContain('cdn.jsdelivr.net')
  })

  it('answers ?import requests in the dev server before Vite rejects public files', () => {
    const plugin = createMediapipePublicWasmJsPlugin({ root: repoRoot })
    const handlers: Array<(req: { url?: string }, res: MockResponse, next: () => void) => void> = []

    plugin.configureServer?.({
      middlewares: {
        use(handler: (req: { url?: string }, res: MockResponse, next: () => void) => void) {
          handlers.push(handler)
        },
      },
    })

    expect(handlers).toHaveLength(1)

    const headers = new Map<string, string>()
    let body = ''
    const res: MockResponse = {
      setHeader(name, value) {
        headers.set(name, value)
      },
      end(data) {
        body = String(data)
      },
    }
    let nextCalled = false
    handlers[0](
      { url: '/vendor/mediapipe/tasks-vision/wasm/vision_wasm_internal.js?import' },
      res,
      () => {
        nextCalled = true
      },
    )

    expect(nextCalled).toBe(false)
    expect(headers.get('Content-Type')).toMatch(/javascript/)
    expect(body).toContain(simdLoaderSource.slice(0, 80))
    expect(body).toContain('self.ModuleFactory = ModuleFactory;')
  })
})

interface MockResponse {
  setHeader: (name: string, value: string) => void
  end: (data: string) => void
}
