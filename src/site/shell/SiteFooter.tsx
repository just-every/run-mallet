import run from '../run.json'

/** The footer strip, set in type: the mark, Mallet and its one line, then Docs, Source and the licence. */
export function SiteFooter() {
  return (
    <footer className="site-foot">
      <div className="site-wrap site-foot-in">
        <p className="site-foot-brand"><img src="/brand/mark.svg" alt="" width={32} height={32} /><span className="site-foot-name">Mallet</span><span className="site-foot-line">Free, open source shop management</span></p>
        <nav aria-label="Footer">
          <a href="/docs">Docs</a>
          <a href={run.repository}>Source</a>
          <a href={`${run.repository}/blob/main/LICENSE`}>MIT licensed</a>
        </nav>
      </div>
    </footer>
  )
}
