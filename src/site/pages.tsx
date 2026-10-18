import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { contractPageHtml } from '../base/contract-page'
import { runPageHtml, siteNotFoundHtml, type RunData, type SiteBuild, type SiteContext } from '../base/run-site'
import { identity } from '../identity'
import { DocsArticle } from './docs/DocsArticle'
import { DocsIndex } from './docs/DocsIndex'
import { docsHead, docsPages } from './docs/pages'
import { Landing } from './landing/Landing'
import run from './run.json'

const fonts = ['/fonts/inter-tight/inter-tight-latin-wght-normal.woff2', '/fonts/inter/inter-latin-wght-normal.woff2']
const shareImage = `${identity.runSite}/site/share.jpg`

/** The icons, tokens and faces every run-site page links, Base's /run and not-found pages included. */
const headLinks = '<link rel="icon" href="/favicon.ico" sizes="32x32"><link rel="icon" type="image/svg+xml" href="/brand/favicon-32.svg"><link rel="apple-touch-icon" href="/apple-touch-icon.png">'
  + fonts.map(href => `<link rel="preload" href="${href}" as="font" type="font/woff2" crossorigin="anonymous">`).join('')
  + '<link rel="stylesheet" href="/site/tokens.css"><link rel="stylesheet" href="/site/run.css">'

/**
 * Base's Run and not-found pages (src/base/run-site.ts, unchanged) in the homepage's look: the site's icons, tokens and
 * /site/run.css go into their head after Base's own style. Base prints the British "licence"; Mallet's run site is
 * for US shops, so its footer line says "license".
 */
/** A separator or arrow never starts a line: the space before each one does not break. */
const glue = (html: string) => html.replace(/ ([·→]) /g, '\u00a0$1 ')

const siteLook = (html: string) => html.replace(/<link rel="icon"[^>]*>/, '').replace('</head>', `${headLinks}</head>`).replaceAll(`${run.licence} licence<`, `${run.licence} license<`)

/**
 * The run site `rer build --site` writes: the approved homepage at /, whose Run Mallet opens the Run page at /run; the
 * docs at /docs and /docs/<slug>, rendered from the repository's Markdown; and the not-found page. Every page is static,
 * reads no installation data and links to no instance-only route.
 */
export function sitePages({ styles, contract }: SiteContext): SiteBuild {
  const data: RunData = run
  const document = (title: string, description: string, body: ReactElement) => '<!doctype html>' + glue(renderToStaticMarkup(
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="theme-color" content="#ffffff" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Mallet" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={shareImage} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="icon" type="image/svg+xml" href="/brand/favicon-32.svg" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {fonts.map(href => <link key={href} rel="preload" href={href} as="font" type="font/woff2" crossOrigin="anonymous" />)}
        <link rel="stylesheet" href="/site/tokens.css" />
        {styles.map(href => <link key={href} rel="stylesheet" href={href} />)}
      </head>
      <body>{body}</body>
    </html>,
  ))
  const docs = (slug?: string) => { const head = docsHead(slug); return [head.title, head.description] as const }
  return {
    pages: [
      { path: '/', html: document('Mallet — Full bays. Cars out on time.', identity.tagline, <Landing />) },
      { path: '/run', html: siteLook(runPageHtml(identity, data, contract)) },
      ...(contract ? [{ path: '/contract', html: siteLook(contractPageHtml(identity, data, contract)) }] : []),
      { path: '/docs', html: document(...docs(), <DocsIndex />) },
      ...docsPages.map(page => ({ path: `/docs/${page.slug}`, html: document(...docs(page.slug), <DocsArticle slug={page.slug} />) })),
      { path: '/404', html: siteLook(siteNotFoundHtml(identity, data, contract)) },
    ],
    assets: ['rer-theme.css', 'fonts', 'brand', 'site', 'favicon.ico', 'apple-touch-icon.png'],
  }
}
