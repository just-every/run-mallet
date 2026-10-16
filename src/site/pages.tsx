import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { runPageHtml, siteNotFoundHtml, type RunData, type SiteBuild, type SiteContext } from '../base/run-site'
import { identity } from '../identity'
import { DocsArticle } from './docs/DocsArticle'
import { DocsIndex } from './docs/DocsIndex'
import { docsHead, docsPages } from './docs/pages'
import { Landing } from './landing/Landing'
import run from './run.json'

const fonts = ['/fonts/sofia-sans/sofia-sans-latin-wght-normal.woff2', '/fonts/sofia-sans/sofia-sans-semi-condensed-latin-wght-normal.woff2']

/**
 * The run site `rer build --site` writes: the approved homepage at /, whose Run Mallet opens the Run page at /run; the
 * docs at /docs and /docs/<slug>, rendered from the repository's Markdown; and the not-found page. Every page is static,
 * reads no installation data and links to no instance-only route.
 */
export function sitePages({ styles }: SiteContext): SiteBuild {
  const data: RunData = run
  const document = (title: string, description: string, body: ReactElement) => '<!doctype html>' + renderToStaticMarkup(
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="icon" href={identity.mark} />
        {fonts.map(href => <link key={href} rel="preload" href={href} as="font" type="font/woff2" crossOrigin="anonymous" />)}
        <link rel="stylesheet" href={identity.theme} />
        {styles.map(href => <link key={href} rel="stylesheet" href={href} />)}
      </head>
      <body className="site">{body}</body>
    </html>,
  )
  const docs = (slug?: string) => { const head = docsHead(slug); return [head.title, head.description] as const }
  return {
    pages: [
      { path: '/', html: document('Mallet — Repairs, exactly as agreed.', identity.tagline, <Landing />) },
      { path: '/run', html: runPageHtml(identity, data) },
      { path: '/docs', html: document(...docs(), <DocsIndex />) },
      ...docsPages.map(page => ({ path: `/docs/${page.slug}`, html: document(...docs(page.slug), <DocsArticle slug={page.slug} />) })),
      { path: '/404', html: siteNotFoundHtml(identity, data) },
    ],
    assets: ['rer-theme.css', 'fonts', 'brand'],
  }
}
