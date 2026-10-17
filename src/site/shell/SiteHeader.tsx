import run from '../run.json'

/** The run site's header: the mark and "Mallet", then Docs, Contract and Source, over a hairline. */
export function SiteHeader({ current }: { current?: 'docs' }) {
  return (
    <header className="site-bar">
      <div className="site-wrap"><div className="site-bar-in">
        <a className="site-brand" href="/"><img src="/brand/mark.svg" alt="" width={28} height={28} /><span>Mallet</span></a>
        <nav aria-label="Site">
          <a href="/docs" aria-current={current === 'docs' ? 'page' : undefined}>Docs</a>
          <a href="/contract">Contract</a>
          <a href={run.repository}>Source</a>
        </nav>
      </div></div>
    </header>
  )
}
