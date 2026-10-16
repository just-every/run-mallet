import run from '../run.json'

/** The run site's footer: the mark, "Mallet · MIT licensed", then Docs and Source. */
export function SiteFooter() {
  return (
    <footer className="site-foot">
      <div className="site-wrap"><div className="site-foot-in">
        <p className="site-foot-brand"><img src="/brand/mark.svg" alt="" width={24} height={24} /><span className="site-foot-name">Mallet</span> · MIT licensed</p>
        <nav aria-label="Footer"><a href="/docs">Docs</a><a href={run.repository}>Source</a></nav>
      </div></div>
    </footer>
  )
}
