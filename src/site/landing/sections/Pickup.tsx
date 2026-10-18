import { Done, Phone, SectionHead, Tick } from '../parts'
import { ro, shop } from '../record'

/**
 * 08: Dana's text thread with the pay link and the paid invoice, beside the quality check and QuickBooks a minute later
 * as stacked, offset cards. The desk drew a third card-phone-card row; BUILD-NOTES asks for this re-layout.
 */
export function Pickup() {
  return (
    <section className="band" aria-labelledby="pickup-title">
      <div className="site-wrap">
        <SectionHead id="pickup-title" eyebrow="Pickup · 4:06 – 4:30 pm" title="Paid before she reaches the counter."
          lead="Luis signs off the road test, Dana gets a ready text with her balance and pays from her phone. QuickBooks has it a minute later." />
        <div className="pickup-stage">
          <Phone time="4:18" className="pickup-phone">
            <p className="thread-from">Buckeye Auto Repair</p>
            <p className="msg in">Hi Dana, your CR-V is ready. Balance {ro.total}. Pay here and skip the line:</p>
            <div className="msg invoice">
              <p className="inv-title">Invoice {ro.invoice} · {ro.number}</p>
              <dl>
                <div><dt>Labor · {ro.laborHours} hrs</dt><dd>{ro.labor}</dd></div>
                <div><dt>Parts</dt><dd>{ro.partsNow}</dd></div>
                <div><dt>Subtotal</dt><dd>{ro.brakesNow}</dd></div>
                <div><dt>Sales tax {shop.taxPercent}%</dt><dd>{ro.tax}</dd></div>
                <div className="total"><dt>Total</dt><dd>{ro.total}</dd></div>
              </dl>
              <p className="phone-button green">Paid with Apple Pay · 4:18 pm <Tick /></p>
            </div>
          </Phone>
          <div className="pickup-stack">
            <article className="card qc">
              <h3>Quality check · {ro.number}</h3>
              <ul className="checks">
                <li><Done />Road test {ro.roadTest}</li>
                <li><Done />Pedal firm, no noise</li>
                <li><Done />Lug nuts 80 ft-lb</li>
              </ul>
              <div className="qc-foot"><p className="qc-signed">Signed {ro.tech} · 4:06 pm</p><p className="pill green">Ready 4:10 pm <Tick /></p></div>
            </article>
            <article className="card books">
              <h3>QuickBooks Online · synced 4:19 pm</h3>
              <ul className="checks rows-list">
                <li><span>Invoice {ro.invoice} · {ro.total}</span><Done /></li>
                <li><span>Payment · Apple Pay · {ro.total}</span><Done /></li>
                <li><span>Sales tax · {shop.county} {shop.taxPercent}% · {ro.tax}</span><Done /></li>
              </ul>
              <p className="books-out">Collected 4:30 pm · {ro.milesOut} out · keys returned</p>
            </article>
          </div>
        </div>
      </div>
    </section>
  )
}
