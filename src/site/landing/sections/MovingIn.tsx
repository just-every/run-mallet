import { Done, SectionHead } from '../parts'
import { count, ro } from '../record'
import run from '../../run.json'

// The repository is kept on one line when the command wraps on a phone.
const repo = run.clone.split(' ').at(-1)!
const command = run.clone.slice(0, -repo.length)

const rows: [string, string][] = [
  ['Customers', `${count(4812)} / ${count(4812)}`],
  ['Vehicles', `${count(6247)} / ${count(6247)} · 3 duplicate VINs merged`],
  ['Repair orders', `${count(31906)} / ${count(31906)}`],
  ['Declined work', `${count(1318)} items · due mileage kept`],
  ['Smart Jobs → canned jobs', '84 / 84'],
  ['Parts matrix · labor rate', `${ro.rate} / hr`],
  ['Inspection templates', '6 / 6'],
  ['Inventory', `${count(1204)} SKUs · $38,412.60 matched`],
  ['Open work', '9 ROs · 22 appointments'],
]

/** 12: the reviewed Tekmetric import with its shadow compare and cutover, and the one line that starts Mallet. */
export function MovingIn() {
  return (
    <section className="band alt" aria-labelledby="move-title">
      <div className="site-wrap split moving">
        <div>
          <SectionHead id="move-title" eyebrow="Moving in · Mon Oct 5" title={`${count(31906)} Tekmetric repair orders, all searchable.`}
            lead="Customers, vehicles, history, canned jobs and open work come across before cutover. Run it yourself with one line." />
          <figure className="terminal" aria-label="Start Mallet on your computer">
            <p className="terminal-dots" aria-hidden="true"><i /><i /><i /></p>
            <pre><code><span className="prompt" aria-hidden="true">$ </span>{command}<span className="repo">{repo}</span>{'\n'}<span className="comment"># clones, installs and starts Mallet on your computer</span></code></pre>
          </figure>
        </div>
        <article className="card import" aria-label="Tekmetric import, reviewed Sunday October 4 at 6:12 pm">
          <header><h3>Tekmetric import</h3><p className="chip">Reviewed Sun Oct 4, 6:12 pm</p></header>
          <ul>
            {rows.map(([k, v]) => <li key={k}><Done /><span>{k}</span><span>{v}</span></li>)}
          </ul>
          <p className="import-foot"><Done /><span>Shadow compare RO 3987 · $612.48 = $612.48 ✓ · cutover Mon Oct 5, 7:00 am</span></p>
        </article>
      </div>
    </section>
  )
}
