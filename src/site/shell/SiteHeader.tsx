import run from '../run.json'

/** The run site's header: the car mark and "Mallet" at left, Docs and Source at right, over a hairline. */
export function SiteHeader({ current }: { current?: 'docs' }) {
  return (
    <header className="site-bar">
      <div className="site-wrap site-bar-in">
        <a className="lockup" href="/" aria-label="Mallet home"><img src="/brand/mark.svg" alt="" width={40} height={40} /><span>Mallet</span></a>
        <nav aria-label="Site">
          <a href="/docs" aria-current={current === 'docs' ? 'page' : undefined}>Docs</a>
          <a href={run.repository}>Source</a>
        </nav>
      </div>
    </header>
  )
}
