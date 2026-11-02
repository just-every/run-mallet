import { Done, SectionHead } from '../parts'
import { count, ro } from '../record'
import run from '../../run.json'

// The one start line every Run Edit Run page shows (the installer, then rer dev), and the alternative for people who already have Node.
const START = `curl -fsSL https://runeditrun.com/install.sh | sh -s -- ${run.clone.slice('npx -y @runeditrun/rer '.length)}`
const ALTERNATIVE = `Already have Node 22 or later? ${run.clone}`

/** A command that wraps only between words, keeping the installer's `install.sh | sh` together. */
function words(line: string) {
  return line.split(/(\S*install\.sh \| sh|\S+)/).map((part, index) => {
    const pipe = /^(.*\/)(install\.sh \| sh)$/.exec(part)
    if (pipe) return <span key={index}><span className="nw">{pipe[1]}</span><wbr /><span className="nw">{pipe[2]}</span></span>
    return part.trim() ? <span key={index} className="nw">{part}</span> : part
  })
}

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
            <pre><code><span className="prompt" aria-hidden="true">$ </span>{words(START)}{'\n'}<span className="comment"># {words('installs rer, then gets and starts Mallet on your computer')}</span>{'\n'}<span className="comment"># {words(ALTERNATIVE)}</span></code></pre>
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
