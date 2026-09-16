import './styles/main.css'

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

void mountApp()
