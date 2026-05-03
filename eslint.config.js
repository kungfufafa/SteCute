import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'

const browserGlobals = {
  Blob: 'readonly',
  CanvasRenderingContext2D: 'readonly',
  CanvasImageSource: 'readonly',
  DOMException: 'readonly',
  Event: 'readonly',
  File: 'readonly',
  FileList: 'readonly',
  HTMLCanvasElement: 'readonly',
  HTMLInputElement: 'readonly',
  HTMLVideoElement: 'readonly',
  Image: 'readonly',
  ImageBitmap: 'readonly',
  MediaDeviceInfo: 'readonly',
  MediaStream: 'readonly',
  MediaStreamConstraints: 'readonly',
  MediaTrackConstraints: 'readonly',
  OffscreenCanvas: 'readonly',
  URL: 'readonly',
  clearInterval: 'readonly',
  clearTimeout: 'readonly',
  confirm: 'readonly',
  console: 'readonly',
  createImageBitmap: 'readonly',
  crypto: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  setInterval: 'readonly',
  setTimeout: 'readonly',
  window: 'readonly',
}

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      '**/*.d.ts',
      'src/**/*.js',
      'playwright.config.js',
      'vite.config.js',
      'vitest.config.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.{js,ts,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: browserGlobals,
    },
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  {
    rules: {
      'vue/attributes-order': 'off',
      'vue/html-indent': 'off',
      'vue/html-self-closing': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/multi-word-component-names': 'off',
      'vue/singleline-html-element-content-newline': 'off',
    },
  },
]
