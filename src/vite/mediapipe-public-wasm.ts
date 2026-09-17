import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Connect, Plugin } from 'vite'

const LOADER_FILE_RE =
  /\/vendor\/mediapipe\/tasks-vision\/wasm\/(vision_wasm(?:_nosimd)?_internal\.js)$/

export function matchMediapipeWasmLoaderFileName(url: string | undefined): string | null {
  const pathname = String(url ?? '').split('?')[0]
  const match = pathname.match(LOADER_FILE_RE)
  return match?.[1] ?? null
}

export function wrapMediapipeWasmLoaderSource(source: string): string {
  return `${source}\nself.ModuleFactory = ModuleFactory;`
}

export function createMediapipePublicWasmJsPlugin(options: { root?: string } = {}): Plugin {
  const root = options.root ?? process.cwd()
  const wasmDir = join(root, 'public/vendor/mediapipe/tasks-vision/wasm')

  function readWrappedLoader(fileName: string): string {
    return wrapMediapipeWasmLoaderSource(readFileSync(join(wasmDir, fileName), 'utf8'))
  }

  const serveMediapipeWasmJs: Connect.NextHandleFunction = (req, res, next) => {
    const fileName = matchMediapipeWasmLoaderFileName(req.url)
    if (!fileName) {
      next()
      return
    }

    const body = readWrappedLoader(fileName)
    res.setHeader('Content-Type', 'text/javascript; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache')
    res.end(body)
  }

  return {
    name: 'stecute-mediapipe-public-wasm-js',
    apply: 'serve',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use(serveMediapipeWasmJs)
    },
    load(id) {
      const fileName = matchMediapipeWasmLoaderFileName(id)
      if (!fileName) return null
      return readWrappedLoader(fileName)
    },
  }
}
