import { Actions } from '../shell/Actions'
import { SiteHeader } from '../shell/SiteHeader'
import { Done, Dot, Painting, Tick, evidence, icons } from './parts'
import { ro } from './record'

/**
 * The approved hero: Buckeye Auto Repair's six open bays painted under the headline, with RO 4127's day pinned to the
 * bays as six cards. The art is the desk's hero with its type and cards taken out; the copy and the cards are HTML at
 * the painted positions (in % of the painting); below 1280 px the picture becomes a crop of the bays and the cards stack.
 */
export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-stage">
        <Painting className="hero-art" name="hero" widths={[768, 1152, 1536]} sizes="min(100vw, 1680px)" eager phone={{ name: 'hero-strip', widths: [600, 1150], media: '(max-width: 1279px)', sizes: '100vw' }} />
        <SiteHeader />
        <div className="hero-copy">
          <h1 id="hero-title">Full bays. Cars out on time.</h1>
          <p className="hero-sub">Mallet checks cars in by VIN, texts photo inspections for line-by-line approval, orders parts, runs the technician board, takes payment and brings customers back.</p>
          <p className="hero-alt">100% free, open source alternative to <strong>Tekmetric</strong>, <strong>Shopmonkey</strong> and <strong>Mitchell 1 Manager SE</strong></p>
          <Actions />
        </div>
        <ol className="hero-cards" aria-label={`${ro.number} on Monday, from drop-off to payment`}>
          <li className="hc hc-ro">
            <span className="hc-thumb car">{evidence.suv}</span>
            <span className="hc-text"><strong>{ro.number} · {ro.vehicle}</strong><span className="hc-ok"><Done />VIN decoded · {ro.milesIn}</span></span>
          </li>
          <li className="hc hc-inspect">
            <span className="hc-thumb">{evidence.rotor}</span>
            <span className="hc-text"><strong>Inspection · <em className="red">2 red</em>, <em className="amber">3 yellow</em></strong><span><Dot tone="red" /><Dot tone="amber" /> texted to {ro.customer}</span><span>9:12 am</span></span>
          </li>
          <li className="hc hc-approve">
            <span className="hc-badge"><Done /></span>
            <span className="hc-text"><strong>Front brakes {ro.brakesFirst} approved</strong><span>cabin filter declined → due at {ro.filterDue}</span></span>
          </li>
          <li className="hc hc-parts">
            <span className="hc-icon">{icons.box}</span>
            <span className="hc-text"><strong>Pads backordered at Worldpac</strong><span>→ PartsTech {ro.padsDelta}</span><span>Dana re-approved 10:05</span></span>
          </li>
          <li className="hc hc-bay">
            <span className="hc-icon">{icons.wrench}</span>
            <span className="hc-text"><strong>Bay 3 · {ro.tech}</strong><span>{ro.laborHours} hrs sold · promise 5:00 pm</span><span>ready <b className="ok">4:10</b> <Tick /></span></span>
          </li>
          <li className="hc hc-paid">
            <span className="hc-icon">{icons.card}</span>
            <span className="hc-text"><strong>Paid by text</strong><span>{ro.total} incl. 7.5% tax</span><span><b className="ok">4:18 pm</b> <Tick /></span></span>
          </li>
        </ol>
      </div>
    </section>
  )
}
