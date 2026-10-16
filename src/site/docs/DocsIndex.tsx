import { SiteFooter } from '../shell/SiteFooter'
import { SiteHeader } from '../shell/SiteHeader'
import { docsLead, docsSections } from './pages'
import './styles'

/** The docs home: a short pegboard strip under the title, then every page as a card, by section. */
export function DocsIndex() {
  return (
    <>
      <SiteHeader current="docs" />
      <main className="site-wrap docs-home">
        <header className="docs-home-head">
          <p className="docs-eyebrow">Docs</p>
          <h1>Mallet docs</h1>
          <p className="docs-lead">{docsLead}</p>
        </header>
        <div className="board docs-strip" aria-hidden="true"><span className="screw tl" /><span className="screw bl" /><span className="screw tr" /><span className="screw br" /></div>
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
      </main>
      <SiteFooter />
    </>
  )
}
