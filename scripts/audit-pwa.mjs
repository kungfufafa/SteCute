import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distDir = resolve(repoRoot, 'dist')
const failures = []

function assert(condition, message) {
  if (!condition) failures.push(message)
}

function readText(path) {
  return readFileSync(path, 'utf8')
}

function readJson(path) {
  return JSON.parse(readText(path))
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function walkFiles(path) {
  return readdirSync(path).flatMap((entry) => {
    const entryPath = join(path, entry)
    return statSync(entryPath).isDirectory() ? walkFiles(entryPath) : [entryPath]
  })
}

function pngSize(path) {
  const buffer = readFileSync(path)
  const signature = buffer.subarray(0, 8).toString('hex')
  assert(signature === '89504e470d0a1a0a', `${path} is not a PNG file`)

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  }
}

function hasManifestIcon(manifest, size, purpose) {
  return manifest.icons?.some((icon) => {
    const hasSize = String(icon.sizes).split(/\s+/).includes(size)
    const purposes = String(icon.purpose ?? 'any').split(/\s+/)
    return hasSize && (!purpose || purposes.includes(purpose))
  })
}

const requiredDistFiles = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  '_headers',
  'netlify.toml',
]
requiredDistFiles.forEach((file) => {
  assert(existsSync(resolve(distDir, file)), `dist/${file} is missing. Run npm run build first.`)
})

if (failures.length === 0) {
  const html = readText(resolve(distDir, 'index.html'))
  const headers = readText(resolve(distDir, '_headers'))
  const netlifyToml = readText(resolve(distDir, 'netlify.toml'))
  const manifest = JSON.parse(readText(resolve(distDir, 'manifest.webmanifest')))
  const sw = readText(resolve(distDir, 'sw.js'))
  const precacheUrls = [...sw.matchAll(/\{url:"([^"]+)"/g)].map((match) => match[1])
  const duplicatePrecacheUrls = [
    ...new Set(precacheUrls.filter((url, index) => precacheUrls.indexOf(url) !== index)),
  ]
  const distJavaScript = walkFiles(distDir)
    .filter((file) => extname(file) === '.js')
    .map((file) => readText(file))
    .join('\n')

  assert(
    /<link rel="manifest" href="\/manifest\.webmanifest"/.test(html),
    'index.html does not link /manifest.webmanifest',
  )
  assert(/name="theme-color"/.test(html), 'index.html is missing theme-color')
  assert(
    /name="apple-mobile-web-app-capable"/.test(html),
    'index.html is missing iOS web app capable meta',
  )
  assert(/name="apple-mobile-web-app-title"/.test(html), 'index.html is missing iOS app title')
  assert(/rel="apple-touch-icon"/.test(html), 'index.html is missing apple-touch-icon')
  assert(
    headers.includes("script-src 'self' 'wasm-unsafe-eval'"),
    '_headers CSP must allow local MediaPipe WASM without enabling JavaScript unsafe-eval',
  )
  assert(
    netlifyToml.includes("script-src 'self' 'wasm-unsafe-eval'"),
    'netlify.toml CSP must allow local MediaPipe WASM without enabling JavaScript unsafe-eval',
  )
  assert(
    headers.includes('Content-Type: application/wasm'),
    '_headers is missing application/wasm for MediaPipe WASM assets',
  )
  assert(
    netlifyToml.includes('Content-Type = "application/wasm"'),
    'netlify.toml is missing application/wasm for MediaPipe WASM assets',
  )
  assert(
    headers.includes('Service-Worker-Allowed: /'),
    '_headers is missing Service-Worker-Allowed for /sw.js',
  )
  assert(
    netlifyToml.includes('Service-Worker-Allowed = "/"'),
    'netlify.toml is missing Service-Worker-Allowed for /sw.js',
  )
  assert(
    headers.includes('Content-Type: application/manifest+json'),
    '_headers is missing manifest content type',
  )
  assert(
    netlifyToml.includes('Content-Type = "application/manifest+json"'),
    'netlify.toml is missing manifest content type',
  )

  assert(manifest.id === '/', 'manifest.id should be /')
  assert(manifest.start_url === '/', 'manifest.start_url should be /')
  assert(manifest.scope === '/', 'manifest.scope should be /')
  assert(manifest.display === 'standalone', 'manifest.display should be standalone')
  assert(manifest.theme_color === '#f45b8d', 'manifest.theme_color should match Stecute pink')
  assert(Boolean(manifest.name && manifest.short_name), 'manifest is missing app names')
  assert(hasManifestIcon(manifest, '192x192'), 'manifest is missing a 192x192 icon')
  assert(hasManifestIcon(manifest, '512x512', 'any'), 'manifest is missing a 512x512 any icon')
  assert(
    hasManifestIcon(manifest, '512x512', 'maskable'),
    'manifest is missing a 512x512 maskable icon',
  )
  assert((manifest.shortcuts ?? []).length >= 2, 'manifest should expose useful app shortcuts')

  assert(precacheUrls.includes('index.html'), 'service worker does not precache index.html')
  assert(
    precacheUrls.includes('manifest.webmanifest'),
    'service worker does not precache manifest.webmanifest',
  )
  assert(
    sw.includes('createHandlerBoundToURL("index.html")') ||
      sw.includes('createHandlerBoundToURL("/index.html")'),
    'service worker is missing app-shell navigation fallback',
  )
  assert(
    duplicatePrecacheUrls.length === 0,
    `service worker has duplicate precache URLs: ${duplicatePrecacheUrls.join(', ')}`,
  )

  const forbiddenRuntimeOrigins = [
    'cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm',
    'storage.googleapis.com/mediapipe-models',
  ]

  forbiddenRuntimeOrigins.forEach((origin) => {
    assert(!distJavaScript.includes(origin), `production JavaScript still references ${origin}`)
  })
}

const requiredPublicIcons = [
  ['public/icons/icon-192x192.png', 192, 192],
  ['public/icons/icon-512x512.png', 512, 512],
  ['public/icons/icon-512x512-maskable.png', 512, 512],
  ['public/icons/apple-touch-icon.png', 180, 180],
]

requiredPublicIcons.forEach(([file, width, height]) => {
  const path = resolve(repoRoot, file)
  assert(existsSync(path), `${file} is missing`)
  if (existsSync(path)) {
    const actual = pngSize(path)
    assert(
      actual.width === width && actual.height === height,
      `${file} should be ${width}x${height}`,
    )
  }
})

const requiredMediapipeAssetUrls = [
  'vendor/mediapipe/tasks-vision/wasm/vision_wasm_internal.js',
  'vendor/mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm',
  'vendor/mediapipe/tasks-vision/wasm/vision_wasm_nosimd_internal.js',
  'vendor/mediapipe/tasks-vision/wasm/vision_wasm_nosimd_internal.wasm',
  'vendor/mediapipe/models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
]

const publicDir = resolve(repoRoot, 'public')
const mediapipeManifestPath = resolve(publicDir, 'vendor/mediapipe/manifest.json')
assert(existsSync(mediapipeManifestPath), 'public/vendor/mediapipe/manifest.json is missing')

let mediapipeManifest
if (existsSync(mediapipeManifestPath)) {
  mediapipeManifest = readJson(mediapipeManifestPath)
  const packageLock = readJson(resolve(repoRoot, 'package-lock.json'))
  const mediapipePackage = packageLock.packages?.['node_modules/@mediapipe/tasks-vision']

  assert(mediapipeManifest.schemaVersion === 1, 'MediaPipe manifest schemaVersion should be 1')
  assert(
    mediapipeManifest.runtimePackage?.name === '@mediapipe/tasks-vision',
    'MediaPipe manifest has the wrong runtime package name',
  )
  assert(
    mediapipeManifest.runtimePackage?.version === mediapipePackage?.version,
    'MediaPipe manifest runtime version does not match package-lock.json',
  )
  assert(
    mediapipeManifest.runtimePackage?.integrity === mediapipePackage?.integrity,
    'MediaPipe manifest runtime integrity does not match package-lock.json',
  )
  assert(
    mediapipeManifest.runtimePackage?.resolved === mediapipePackage?.resolved,
    'MediaPipe manifest runtime resolved URL does not match package-lock.json',
  )
  assert(
    mediapipeManifest.runtimePackage?.license === 'Apache-2.0',
    'MediaPipe manifest runtime license should be Apache-2.0',
  )
  assert(Boolean(mediapipeManifest.approver), 'MediaPipe manifest is missing an approver')
  assert(
    mediapipeManifest.model?.sourceUrl ===
      'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
    'MediaPipe manifest model source URL is incorrect',
  )
  assert(
    mediapipeManifest.model?.license === 'Apache-2.0',
    'MediaPipe manifest model license should be Apache-2.0',
  )

  const manifestAssets = new Map(
    (mediapipeManifest.assets ?? []).map((asset) => [asset.path, asset]),
  )

  requiredMediapipeAssetUrls.forEach((distUrl) => {
    const asset = manifestAssets.get(distUrl)
    assert(Boolean(asset), `MediaPipe manifest is missing ${distUrl}`)

    const publicPath = resolve(publicDir, distUrl)
    assert(existsSync(publicPath), `public/${distUrl} is missing`)
    if (existsSync(publicPath) && asset) {
      const actualSize = statSync(publicPath).size
      const actualHash = sha256(publicPath)
      assert(actualSize > 0, `public/${distUrl} is empty`)
      assert(asset.sizeBytes === actualSize, `MediaPipe manifest size mismatch for ${distUrl}`)
      assert(asset.sha256 === actualHash, `MediaPipe manifest sha256 mismatch for ${distUrl}`)
      assert(Boolean(asset.contentType), `MediaPipe manifest contentType missing for ${distUrl}`)
    }

    if (asset?.sourcePath) {
      const sourcePath = resolve(repoRoot, asset.sourcePath)
      assert(
        existsSync(sourcePath),
        `MediaPipe manifest sourcePath is missing: ${asset.sourcePath}`,
      )
      if (existsSync(sourcePath)) {
        assert(
          sha256(sourcePath) === asset.sha256,
          `MediaPipe vendored file does not match source package file: ${distUrl}`,
        )
      }
    }

    const distPath = resolve(distDir, distUrl)
    assert(existsSync(distPath), `dist/${distUrl} is missing`)
    if (existsSync(distPath) && asset) {
      assert(sha256(distPath) === asset.sha256, `dist/${distUrl} does not match manifest sha256`)
    }
  })

  const vendorFiles = walkFiles(resolve(publicDir, 'vendor/mediapipe'))
    .map((file) => relative(publicDir, file).split('\\').join('/'))
    .filter((file) => file !== 'vendor/mediapipe/manifest.json')
  const undocumentedVendorFiles = vendorFiles.filter((file) => !manifestAssets.has(file))
  assert(
    undocumentedVendorFiles.length === 0,
    `MediaPipe vendor files missing from manifest: ${undocumentedVendorFiles.join(', ')}`,
  )
}

const mediapipeManifestDistUrl = 'vendor/mediapipe/manifest.json'
assert(
  existsSync(resolve(distDir, mediapipeManifestDistUrl)),
  `dist/${mediapipeManifestDistUrl} is missing`,
)

if (existsSync(resolve(distDir, 'sw.js'))) {
  const sw = readText(resolve(distDir, 'sw.js'))
  const precacheUrls = [...sw.matchAll(/\{url:"([^"]+)"/g)].map((match) => match[1])

  requiredMediapipeAssetUrls.forEach((distUrl) => {
    assert(precacheUrls.includes(distUrl), `service worker does not precache ${distUrl}`)
  })
  assert(
    precacheUrls.includes(mediapipeManifestDistUrl),
    `service worker does not precache ${mediapipeManifestDistUrl}`,
  )
}

if (existsSync(resolve(distDir, '_headers')) && existsSync(resolve(distDir, 'netlify.toml'))) {
  const headers = readText(resolve(distDir, '_headers'))
  const netlifyToml = readText(resolve(distDir, 'netlify.toml'))
  const deploymentHeaderRequirements = [
    "script-src 'self' 'wasm-unsafe-eval'",
    'Content-Type: application/wasm',
    'Content-Type: application/manifest+json',
    'Service-Worker-Allowed: /',
  ]

  const netlifyHeaderRequirements = [
    "script-src 'self' 'wasm-unsafe-eval'",
    'Content-Type = "application/wasm"',
    'Content-Type = "application/manifest+json"',
    'Service-Worker-Allowed = "/"',
  ]

  deploymentHeaderRequirements.forEach((requirement, index) => {
    assert(headers.includes(requirement), `_headers is missing ${requirement}`)
    assert(
      netlifyToml.includes(netlifyHeaderRequirements[index]),
      `netlify.toml is missing ${requirement}`,
    )
  })
}

if (failures.length > 0) {
  console.error('PWA audit failed:')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('PWA audit passed.')
