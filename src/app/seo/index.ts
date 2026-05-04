import { publicPages } from '@/features/public-info/content'
import seoRoutes from './routes.json'

type SeoSchema = 'webApplication' | 'webPage' | 'faq'

export type SeoRoute = {
  id: string
  path: string
  title: string
  description: string
  schema?: SeoSchema
  robots?: string
}

type SeoCatalog = {
  siteName: string
  siteUrl: string
  locale: string
  language: string
  defaultImage: string
  indexable: SeoRoute[]
  appRoutes: SeoRoute[]
  legacyNoindexPaths: string[]
}

type JsonLd = Record<string, unknown>

const seoCatalog = seoRoutes as SeoCatalog
const indexableRoutes = new Map(seoCatalog.indexable.map((route) => [route.id, route]))
const appRoutes = new Map(seoCatalog.appRoutes.map((route) => [route.id, route]))
const noindexFallback: SeoRoute = {
  id: 'app',
  path: '/',
  title: `${seoCatalog.siteName} Photo Booth`,
  description:
    'Stecute adalah photo booth web offline-first untuk membuat photo strip lokal tanpa login.',
  robots: 'noindex,nofollow',
}

export function getIndexableSeo(id: string): SeoRoute {
  return indexableRoutes.get(id) ?? noindexFallback
}

export function getAppSeo(id: string): SeoRoute {
  return appRoutes.get(id) ?? noindexFallback
}

export function applySeo(routeSeo?: SeoRoute, currentPath = '/'): void {
  if (typeof document === 'undefined') return

  const seo = routeSeo ?? {
    ...noindexFallback,
    path: currentPath,
  }
  const canonicalPath = normalizePath(seo.path || currentPath)
  const canonicalUrl = createAbsoluteUrl(canonicalPath)
  const imageUrl = createAbsoluteUrl(seoCatalog.defaultImage)
  const robots = seo.robots ?? 'index,follow'

  document.documentElement.lang = seoCatalog.language
  document.title = seo.title

  setMeta('name', 'description', seo.description)
  setMeta('name', 'robots', robots)
  setMeta('name', 'application-name', seoCatalog.siteName)
  setMeta('name', 'apple-mobile-web-app-title', seoCatalog.siteName)

  setCanonical(canonicalUrl)

  setMeta('property', 'og:site_name', seoCatalog.siteName)
  setMeta('property', 'og:locale', seoCatalog.locale)
  setMeta('property', 'og:type', 'website')
  setMeta('property', 'og:title', seo.title)
  setMeta('property', 'og:description', seo.description)
  setMeta('property', 'og:url', canonicalUrl)
  setMeta('property', 'og:image', imageUrl)
  setMeta('property', 'og:image:alt', 'Preview photo strip Stecute')

  setMeta('name', 'twitter:card', 'summary_large_image')
  setMeta('name', 'twitter:title', seo.title)
  setMeta('name', 'twitter:description', seo.description)
  setMeta('name', 'twitter:image', imageUrl)

  setJsonLd(createJsonLd(seo, canonicalUrl))
}

function createJsonLd(seo: SeoRoute, canonicalUrl: string): JsonLd | null {
  if (seo.robots?.startsWith('noindex')) return null

  const base = {
    '@context': 'https://schema.org',
    name: seo.title,
    description: seo.description,
    url: canonicalUrl,
    inLanguage: seoCatalog.language,
  }

  if (seo.schema === 'webApplication') {
    return {
      ...base,
      '@type': 'WebApplication',
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Any',
      browserRequirements: 'Requires a modern browser with camera, canvas, and storage support.',
      featureList: [
        'Photo booth browser tanpa login',
        'Capture kamera atau upload lokal',
        'Review dan retake per-shot',
        'Render PNG lokal',
        'Gallery lokal terbatas',
        'Mode offline setelah cache awal',
      ],
    }
  }

  if (seo.schema === 'faq') {
    const questions = publicPages.faq.sections.flatMap((section) =>
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

    return {
      ...base,
      '@type': 'FAQPage',
      mainEntity: questions,
    }
  }

  return {
    ...base,
    '@type': 'WebPage',
  }
}

function setMeta(attribute: 'name' | 'property', key: string, content: string): void {
  const selector = `meta[${attribute}="${key}"]`
  const existing = document.head.querySelector<HTMLMetaElement>(selector)
  const element = existing ?? document.createElement('meta')

  if (!existing) {
    element.setAttribute(attribute, key)
    document.head.appendChild(element)
  }

  element.setAttribute('content', content)
}

function setCanonical(href: string): void {
  const existing = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  const element = existing ?? document.createElement('link')

  if (!existing) {
    element.setAttribute('rel', 'canonical')
    document.head.appendChild(element)
  }

  element.setAttribute('href', href)
}

function setJsonLd(data: JsonLd | null): void {
  const scriptId = 'stecute-jsonld'
  const existing = document.getElementById(scriptId)

  if (!data) {
    existing?.remove()
    return
  }

  const script = existing ?? document.createElement('script')
  script.id = scriptId
  script.setAttribute('type', 'application/ld+json')
  script.textContent = JSON.stringify(data)

  if (!existing) {
    document.head.appendChild(script)
  }
}

function createAbsoluteUrl(path: string): string {
  const configuredSiteUrl = String(import.meta.env.VITE_PUBLIC_SITE_URL || '').replace(/\/$/, '')
  const baseUrl =
    configuredSiteUrl ||
    seoCatalog.siteUrl ||
    (typeof window !== 'undefined' ? window.location.origin : '')

  return new URL(path, `${baseUrl}/`).toString()
}

function normalizePath(path: string): string {
  if (!path.startsWith('/')) return `/${path}`
  return path
}
