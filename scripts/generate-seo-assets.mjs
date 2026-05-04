import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { absoluteUrl, getSiteUrl, readSeoCatalog, repoRoot } from './seo-utils.mjs'

const catalog = readSeoCatalog()
const siteUrl = getSiteUrl(catalog)
const publicDir = resolve(repoRoot, 'public')
const sitemapPath = resolve(publicDir, 'sitemap.xml')
const robotsPath = resolve(publicDir, 'robots.txt')

mkdirSync(publicDir, { recursive: true })

writeFileSync(sitemapPath, createSitemap(catalog, siteUrl))
writeFileSync(robotsPath, createRobots(catalog, siteUrl))

console.log(`Generated SEO assets for ${siteUrl}`)

function createSitemap(seoCatalog, baseUrl) {
  const urls = seoCatalog.indexable
    .map(
      (route) => `  <url>
    <loc>${escapeXml(absoluteUrl(baseUrl, route.path))}</loc>
    <lastmod>${route.lastmod}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`,
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
}

function createRobots(seoCatalog, baseUrl) {
  void seoCatalog

  return `User-agent: *
Allow: /

Sitemap: ${absoluteUrl(baseUrl, '/sitemap.xml')}
`
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}
