import { docsSections } from './pages'

/** Every docs page by section; the current page wears the red outline, as the app's current tab does. */
export function DocsNav({ current }: { current?: string }) {
  return (
    <nav className="docs-nav" aria-label="Docs">
      <a className="docs-nav-home" href="/docs" aria-current={current === undefined ? 'page' : undefined}>All docs</a>
      {docsSections.map(section => (
        <div key={section.title} className="docs-nav-group">
          <p className="docs-nav-title">{section.title}</p>
          <ul>{section.pages.map(page => <li key={page.slug}><a href={`/docs/${page.slug}`} aria-current={page.slug === current ? 'page' : undefined}>{page.title}</a></li>)}</ul>
        </div>
      ))}
    </nav>
  )
}
