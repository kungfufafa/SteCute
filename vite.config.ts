import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

function isPublicImagePng(url: string) {
  return /^images\/[^/]+\.png$/.test(url)
}

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        id: '/',
        name: 'Stecute',
        short_name: 'Stecute',
        description: 'Photo booth web offline-first untuk membuat photo strip lokal tanpa login',
        lang: 'id-ID',
        dir: 'ltr',
        theme_color: '#f45b8d',
        background_color: '#ffffff',
        display: 'standalone',
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
      },
      integration: {
        beforeBuildServiceWorker(options) {
          options.workbox.additionalManifestEntries = (
            options.workbox.additionalManifestEntries ?? []
          ).filter((entry) => !isPublicImagePng(typeof entry === 'string' ? entry : entry.url))
        },
      },
      workbox: {
        globPatterns: [
          '**/*.{js,css,html,ico,svg,woff2,webp}',
          'assets/*.png',
          'icons/*.png',
          'manifest/*.webmanifest',
          'manifest.webmanifest',
        ],
        globIgnores: ['images/*.png', '**/images/*.png'],
        manifestTransforms: [
          async (entries) => ({
            manifest: entries.filter((entry) => !isPublicImagePng(entry.url)),
            warnings: [],
          }),
        ],
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
