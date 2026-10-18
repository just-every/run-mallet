import { Dot, Phone, SectionHead, Tick } from '../parts'
import { ro } from '../record'

/** 05: the agent prices what Luis found with MOTOR times, Kayla checks it, and Dana approves line by line. */
export function Approve() {
  return (
    <section className="band" aria-labelledby="approve-title">
      <div className="site-wrap">
        <SectionHead className="center" id="approve-title" eyebrow="Approve · 9:05 – 9:24 am" title="Approved line by line." lead="The agent prices what Luis found. Dana says yes to the brakes and not now to the filter." />
        <div className="approve-row">
          <article className="card estimate" aria-label="Estimate drafted by the service advisor agent at 9:05 am">
            <h3>Estimate drafted by the service advisor agent · 9:05 am</h3>
            <dl className="rows">
              <div><dt>Pads 2 mm, rotors scored → front pads and rotors</dt><dd>MOTOR {ro.motorBrakes} hrs</dd></div>
              <div><dt>Fluid 3.5% moisture → brake fluid flush</dt><dd>MOTOR {ro.motorFluid} hrs</dd></div>
              <div><dt>Labor {ro.laborHours} hrs × {ro.rate}</dt><dd>{ro.labor}</dd></div>
              <div><dt>Parts in stock · Worldpac</dt><dd>{ro.partsFirst}</dd></div>
              <div className="total"><dt>Front brakes</dt><dd>{ro.brakesFirst}</dd></div>
            </dl>
            <p className="chip">Checked by {ro.advisor} · 9:10 am</p>
          </article>
          <Phone time="9:24" className="approve-phone">
            <p className="phone-title small">Your CR-V · {ro.number}</p>
            <ul className="approve-lines">
              <li><p><span>Front brakes · pads, rotors, fluid</span><strong>{ro.brakesFirst}</strong></p><span className="pill solid-green">Approved <Tick /></span></li>
              <li><p><span>Cabin air filter</span><strong>{ro.filter}</strong></p><span className="pill grey">Declined</span></li>
              <li className="watch"><Dot tone="amber" />Rear tires 4/32 in · watch</li>
              <li className="watch"><Dot tone="amber" />Battery 68% · retest next visit</li>
            </ul>
            <p className="approve-total"><strong>Approved</strong><span>{ro.brakesFirst} + tax</span></p>
            <p className="approve-signed">Signed {ro.customer} · 9:24 am</p>
          </Phone>
          <article className="card declined" aria-label="Declined work kept for follow-up">
            <h3>Declined work</h3>
            <dl className="rows">
              <div><dt>Cabin air filter · {ro.filter}</dt></div>
              <div><dt>Declined Mon Oct 19 at {ro.milesIn}</dt></div>
            </dl>
            <p className="pill cyan big">Due at {ro.filterDue}</p>
            <p className="declined-kept">Kept with photo and price</p>
          </article>
        </div>
      </div>
    </section>
  )
}
