import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'
import {
  buildSeoBlock,
  createStaticJsonLd,
  getSiteUrl,
  readSeoCatalog,
  replaceSeoBlock,
  repoRoot,
} from './seo-utils.mjs'

const catalog = readSeoCatalog()
const siteUrl = getSiteUrl(catalog)
const distDir = resolve(repoRoot, 'dist')
const indexPath = resolve(distDir, 'index.html')
const template = readFileSync(indexPath, 'utf8')
const publicPages = loadPublicPages()
const routesToWrite = [
  ...catalog.indexable,
  ...catalog.appRoutes,
  ...catalog.legacyNoindexPaths.map((path) => ({
    id: path.replace(/^\/+/, '') || 'app',
    path,
    title: 'Stecute Photo Booth',
    description: 'Route aplikasi Stecute.',
    robots: 'noindex,nofollow',
  })),
]

for (const route of routesToWrite) {
  const jsonLd = createStaticJsonLd(
    catalog,
    route,
    siteUrl,
    createFaqMainEntity(route, publicPages),
  )
  const routeHtml = replaceAppContent(
    replaceSeoBlock(template, buildSeoBlock(catalog, route, siteUrl, jsonLd)),
    createStaticAppContent(route, publicPages),
  )
  const outputPath =
    route.path === '/' ? indexPath : resolve(distDir, route.path.replace(/^\/+/, ''), 'index.html')

  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, routeHtml)
}

console.log(
  `Wrote static SEO HTML for ${catalog.indexable.length} public routes and ${routesToWrite.length - catalog.indexable.length} app routes.`,
)

function loadPublicPages() {
  const contentPath = resolve(repoRoot, 'src/features/public-info/content.ts')
  const source = readFileSync(contentPath, 'utf8')
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
  const module = { exports: {} }

  vm.runInNewContext(transpiled, { exports: module.exports, module }, { filename: contentPath })

  return module.exports.publicPages
}

function createFaqMainEntity(route, pages) {
  if (route.schema !== 'faq') return undefined

  return pages.faq.sections.flatMap((section) =>
    section.type === 'faq'
      ? section.items.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer.join(' '),
          },
        }))
      : [],
  )
}

function replaceAppContent(html, appContent) {
  return html.replace('<div id="app"></div>', `<div id="app">${appContent}</div>`)
}

function createStaticAppContent(route, pages) {
  if (route.id === 'landing') {
    return `<main class="seo-fallback">
      <div class="seo-fallback__inner">
        <h1>Stecute Photo Booth</h1>
        <p>Photo booth web offline-first untuk membuat photo strip lokal dari kamera atau upload foto, tanpa login.</p>
        <nav class="seo-fallback__actions" aria-label="Mulai Stecute">
          <a href="/config?source=camera">Mulai Foto</a>
          <a href="/config?source=upload">Upload Lokal</a>
          <a href="/gallery">Galeri</a>
        </nav>
        <ul>
          <li>Foto diproses lokal di browser.</li>
          <li>Layout 2, 3, 4, dan 6 pose.</li>
          <li>Template Classic, Youth, dan Mono.</li>
          <li>Output utama PNG dengan gallery lokal terbatas.</li>
          <li>Mode offline tersedia setelah cache awal berhasil.</li>
        </ul>
        <p class="seo-fallback__links"><a href="/about">Tentang Stecute</a> <a href="/faq">FAQ</a> <a href="/privacy">Kebijakan Privasi</a> <a href="/terms">Syarat & Ketentuan</a></p>
      </div>
    </main>`
  }

  const page = pages[route.id]
  if (!page) {
    return `<main class="seo-fallback">
      <h1>${escapeHtml(route.title)}</h1>
      <p>${escapeHtml(route.description)}</p>
    </main>`
  }

  const sections = page.sections
    .map((section) => {
      if (section.type === 'faq') {
        const items = section.items
          .map(
            (item) => `<section>
              <h3>${escapeHtml(item.question)}</h3>
              ${item.answer.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}
            </section>`,
          )
          .join('')

        return `<section>
          <h2>${escapeHtml(section.title)}</h2>
          ${section.intro ? `<p>${escapeHtml(section.intro)}</p>` : ''}
          ${items}
        </section>`
      }

      return `<section>
        <h2>${escapeHtml(section.title)}</h2>
        ${section.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}
        ${section.bullets?.length ? `<ul>${section.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('')}</ul>` : ''}
      </section>`
    })
    .join('')

  return `<main class="seo-fallback">
    <p>${escapeHtml(page.eyebrow)}</p>
    <h1>${escapeHtml(page.title)}</h1>
    <p>${escapeHtml(page.summary)}</p>
    <article>${sections}</article>
  </main>`
}

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}
