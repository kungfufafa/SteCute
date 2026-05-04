import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export function readSeoCatalog() {
  const catalogPath = resolve(repoRoot, 'src/app/seo/routes.json')
  return JSON.parse(readFileSync(catalogPath, 'utf8'))
}

export function getSiteUrl(catalog) {
  const rawUrl =
    process.env.VITE_PUBLIC_SITE_URL || process.env.SITE_URL || process.env.URL || catalog.siteUrl

  return String(rawUrl).replace(/\/+$/, '')
}

export function absoluteUrl(siteUrl, path) {
  return new URL(path, `${siteUrl}/`).toString()
}

export function buildSeoBlock(
  catalog,
  route,
  siteUrl,
  jsonLd = createStaticJsonLd(catalog, route, siteUrl),
) {
  const canonicalUrl = absoluteUrl(siteUrl, route.path)
  const imageUrl = absoluteUrl(siteUrl, catalog.defaultImage)
  const robots = route.robots || 'index,follow'

  return `<!--stecute-seo-static-->
  <title>${escapeHtml(route.title)}</title>
  <meta name="description" content="${escapeAttribute(route.description)}" />
  <meta name="robots" content="${escapeAttribute(robots)}" />
  <link rel="canonical" href="${escapeAttribute(canonicalUrl)}" />
  <meta property="og:site_name" content="${escapeAttribute(catalog.siteName)}" />
  <meta property="og:locale" content="${escapeAttribute(catalog.locale)}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeAttribute(route.title)}" />
  <meta property="og:description" content="${escapeAttribute(route.description)}" />
  <meta property="og:url" content="${escapeAttribute(canonicalUrl)}" />
  <meta property="og:image" content="${escapeAttribute(imageUrl)}" />
  <meta property="og:image:alt" content="Preview photo strip Stecute" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeAttribute(route.title)}" />
  <meta name="twitter:description" content="${escapeAttribute(route.description)}" />
  <meta name="twitter:image" content="${escapeAttribute(imageUrl)}" />
  ${jsonLd ? `<script id="stecute-jsonld" type="application/ld+json">${escapeScriptJson(jsonLd)}</script>` : ''}
  <!--/stecute-seo-static-->`
}

export function replaceSeoBlock(html, block) {
  const seoBlockPattern = /<!--stecute-seo-static-->[\s\S]*?<!--\/stecute-seo-static-->/

  if (!seoBlockPattern.test(html)) {
    throw new Error('SEO marker block not found in HTML template.')
  }

  return html.replace(seoBlockPattern, block)
}

export function createStaticJsonLd(catalog, route, siteUrl, mainEntity) {
  if (route.robots?.startsWith('noindex')) return null

  const canonicalUrl = absoluteUrl(siteUrl, route.path)
  const base = {
    '@context': 'https://schema.org',
    name: route.title,
    description: route.description,
    url: canonicalUrl,
    inLanguage: catalog.language,
  }

  if (route.schema === 'webApplication') {
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

  if (route.schema === 'faq' && mainEntity?.length) {
    return {
      ...base,
      '@type': 'FAQPage',
      mainEntity,
    }
  }

  return {
    ...base,
    '@type': 'WebPage',
  }
}

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('"', '&quot;')
}

function escapeScriptJson(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c')
}
