import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

function isPublicImagePng(url: string) {
  return /^images\/[^/]+\.png$/.test(url)
}

function isPwaGeneratedPrecacheDuplicate(url: string) {
  return url === 'manifest.webmanifest' || /^icons\/[^/]+\.png$/.test(url) || isPublicImagePng(url)
}

function loadDevHttpsOptions() {
  if (process.env.STECUTE_DEV_HTTPS !== '1') {
    return undefined
  }

  const keyPath = fileURLToPath(new URL('./.certs/stecute-dev.key', import.meta.url))
  const certPath = fileURLToPath(new URL('./.certs/stecute-dev.crt', import.meta.url))

  if (!existsSync(keyPath) || !existsSync(certPath)) {
    throw new Error('Missing dev HTTPS certificate. Run `npm run dev:https` to generate it.')
  }

  return {
    key: readFileSync(keyPath),
    cert: readFileSync(certPath),
  }
}

const devHttpsOptions = loadDevHttpsOptions()

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        id: '/',
        name: 'Stecute',
        short_name: 'Stecute',
        description: 'Photo booth web offline-first untuk membuat photo strip lokal tanpa login',
        lang: 'id-ID',
        dir: 'ltr',
        theme_color: '#f45b8d',
        background_color: '#f8f9fc',
        display: 'standalone',
        display_override: ['standalone', 'browser'],
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        categories: ['photo', 'entertainment'],
        prefer_related_applications: false,
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512x512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Mulai Foto',
            short_name: 'Foto',
            description: 'Mulai sesi photo booth dari kamera.',
            url: '/config?source=camera',
            icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Upload Lokal',
            short_name: 'Upload',
            description: 'Buat photo strip dari foto lokal.',
            url: '/config?source=upload',
            icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Galeri',
            short_name: 'Galeri',
            description: 'Buka galeri render lokal.',
            url: '/gallery',
            icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
      integration: {
        beforeBuildServiceWorker(options) {
          options.workbox.additionalManifestEntries = (
            options.workbox.additionalManifestEntries ?? []
          ).filter(
            (entry) =>
              !isPwaGeneratedPrecacheDuplicate(typeof entry === 'string' ? entry : entry.url),
          )
        },
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2,webp,png,json,webmanifest,wasm,tflite}'],
        globIgnores: ['images/*.png', '**/images/*.png'],
        manifestTransforms: [
          async (entries) => ({
            manifest: entries.filter((entry) => !isPublicImagePng(entry.url)),
            warnings: [],
          }),
        ],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        navigateFallback: '/index.html',
        runtimeCaching: [],
      },
    }),
  ],
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.vue', '.json'],
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@stores': fileURLToPath(new URL('./src/stores.ts', import.meta.url)),
      '@app': fileURLToPath(new URL('./src/app', import.meta.url)),
      '@features': fileURLToPath(new URL('./src/features', import.meta.url)),
      '@components': fileURLToPath(new URL('./src/components', import.meta.url)),
      '@services': fileURLToPath(new URL('./src/services', import.meta.url)),
      '@layouts': fileURLToPath(new URL('./src/layouts', import.meta.url)),
      '@db': fileURLToPath(new URL('./src/db', import.meta.url)),
      '@utils': fileURLToPath(new URL('./src/utils', import.meta.url)),
      '@assets': fileURLToPath(new URL('./src/assets', import.meta.url)),
    },
  },
  server: {
    host: devHttpsOptions ? '0.0.0.0' : undefined,
    https: devHttpsOptions,
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/vue') || id.includes('node_modules/@vue')) {
            return 'vendor-vue'
          }

          if (id.includes('node_modules/vue-router') || id.includes('node_modules/pinia')) {
            return 'vendor-app'
          }

          if (id.includes('node_modules/@mediapipe')) {
            return 'vendor-mediapipe'
          }
        },
      },
    },
  },
})
