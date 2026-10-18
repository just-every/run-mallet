import { SiteFooter } from '../shell/SiteFooter'
import { SiteHeader } from '../shell/SiteHeader'
import { docsLead, docsSections } from './pages'
import './styles'

/** The docs home: the title and lead on the pale band, then every page as a card, by section. */
export function DocsIndex() {
  return (
    <>
      <SiteHeader current="docs" />
      <main className="docs-home">
        <header className="docs-home-head"><div className="site-wrap">
          <p className="eyebrow">Docs</p>
          <h1>Mallet docs</h1>
          <p className="docs-lead">{docsLead}</p>
        </div></header>
        <div className="site-wrap">
        {docsSections.map(section => (
          <section key={section.title} className="docs-group" aria-labelledby={`group-${section.pages[0].slug}`}>
            <h2 id={`group-${section.pages[0].slug}`}>{section.title}</h2>
            <ul className="docs-cards">
              {section.pages.map(page => (
                <li key={page.slug}><a className="docs-card" href={`/docs/${page.slug}`}><span className="docs-card-title">{page.title}</span><span className="docs-card-summary">{page.summary}</span></a></li>
              ))}
            </ul>
          </section>
        ))}
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
