import { SiteFooter } from '../shell/SiteFooter'
import { SiteHeader } from '../shell/SiteHeader'
import { DocsNav } from './DocsNav'
import { docsNeighbours, getDocsPage } from './pages'
import './styles'

/** One docs page: the section list, the article rendered from Markdown at build time, its contents and the pager. */
export function DocsArticle({ slug }: { slug: string }) {
  const page = getDocsPage(slug)
  if (!page) throw new Error(`No docs page "${slug}".`)
  const { previous, next } = docsNeighbours(slug)
  return (
    <>
      <SiteHeader current="docs" />
      <div className="site-wrap docs-shell">
        <details className="docs-menu"><summary>All docs</summary><DocsNav current={slug} /></details>
        <aside className="docs-side"><DocsNav current={slug} /></aside>
        <main className="docs-main">
          <article aria-labelledby="docs-title">
            <header className="docs-page-head">
              <p className="eyebrow">{page.section}</p>
              <h1 id="docs-title">{page.title}</h1>
              <p className="docs-lead">{page.summary}</p>
            </header>
            {page.toc.filter(entry => entry.depth === 2).length > 2 ? (
              <nav className="docs-toc" aria-label="On this page">
                <p>On this page</p>
                <ul>{page.toc.filter(entry => entry.depth === 2).map(entry => <li key={entry.id}><a href={`#${entry.id}`}>{entry.text}</a></li>)}</ul>
              </nav>
            ) : null}
            <div className="docs-prose" dangerouslySetInnerHTML={{ __html: page.html }} />
          </article>
          <nav className="docs-pager" aria-label="Previous and next">
            {previous ? <a className="prev" href={`/docs/${previous.slug}`}><span>Previous</span>{previous.title}</a> : <span />}
            {next ? <a className="next" href={`/docs/${next.slug}`}><span>Next</span>{next.title}</a> : null}
          </nav>
        </main>
      </div>
      <SiteFooter />
    </>
  )
}
