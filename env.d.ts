/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_BOOTH_TURN_API_KEY?: string
  readonly VITE_BOOTH_TURN_APP?: string
  readonly VITE_BOOTH_TURN_CREDENTIALS_URL?: string
  readonly VITE_BOOTH_ICE_SERVERS?: string
  readonly VITE_PUBLIC_SITE_URL?: string
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}
