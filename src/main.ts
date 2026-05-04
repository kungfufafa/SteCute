import './styles/main.css'

const LANDING_MOUNT_DELAY_MS = 4000
let mountPromise: Promise<void> | null = null

function mountApp() {
  if (mountPromise) return mountPromise

  mountPromise = Promise.all([
    import('vue'),
    import('pinia'),
    import('./App.vue'),
    import('./app/router'),
  ]).then(([{ createApp }, { createPinia }, { default: App }, { default: router }]) => {
    const app = createApp(App)

    app.use(createPinia())
    app.use(router)
    app.mount('#app')
  })

  return mountPromise
}

const isStaticLanding =
  window.location.pathname === '/' && document.querySelector('.seo-fallback') !== null

if (isStaticLanding) {
  window.setTimeout(() => {
    void mountApp()
  }, LANDING_MOUNT_DELAY_MS)
} else {
  void mountApp()
}
