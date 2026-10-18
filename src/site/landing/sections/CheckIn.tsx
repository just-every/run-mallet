import { Phone, SectionHead, Tick } from '../parts'
import { ro } from '../record'

/** 03: Dana's after-hours check-in at the drop box feeds RO 4127, with the VIN decoded and her Tekmetric history. */
export function CheckIn() {
  return (
    <section className="band" aria-labelledby="checkin-title">
      <div className="site-wrap split checkin">
        <SectionHead id="checkin-title" eyebrow="Check-in · 7:41 am" title={<>Keys in the box. <br className="wide" />Car on file.</>}
          lead="Dana checks in from her phone at the drop box. Mallet decodes the VIN and has the repair order ready when Kayla opens it." />
        <div className="checkin-stage">
          <Phone time="7:41" className="checkin-phone">
            <div className="app-bar"><p>Buckeye Auto Repair</p><span className="menu" aria-hidden="true"><i /><i /><i /></span></div>
            <p className="phone-title">Drop-off check-in</p>
            <dl className="phone-form">
              <div><dt>Name</dt><dd>{ro.customer} <span className="ok-text">· verified by text <Tick /></span></dd></div>
              <div><dt>Vehicle</dt><dd>2019 Honda CR-V · {ro.plate}</dd></div>
              <div><dt>What’s wrong?</dt><dd>Brakes squeal when stopping</dd></div>
              <div><dt>Key</dt><dd>Drop box · slot 14</dd></div>
            </dl>
            <p className="phone-button green">Checked in 7:41 am <Tick /></p>
          </Phone>
          <svg className="checkin-arrow" viewBox="0 0 160 60" aria-hidden="true"><path d="M4 50C40 6 104 2 146 34" /><path d="M134 22l13 13-17 4" /></svg>
          <article className="card ro-card" aria-label={`${ro.number}, opened 7:52 am`}>
            <header><h3>{ro.number}</h3><p className="chip">Opened 7:52 am · {ro.advisor}</p></header>
            <p className="vin"><span>VIN <code>{ro.vin}</code></span><span className="pill green">Decoded <Tick /></span></p>
            <p className="ro-trim">{ro.trim}</p>
            <dl className="rows">
              <div><dt>Mileage in</dt><dd>{ro.milesIn}</dd></div>
              <div><dt>Last visit</dt><dd>Tue Apr 14 · 56,480 mi · oil service</dd></div>
              <div><dt>History</dt><dd>6 visits · 5 imported from Tekmetric</dd></div>
              <div><dt>Inspection</dt><dd>39-point courtesy · no charge</dd></div>
            </dl>
          </article>
        </div>
      </div>
    </section>
  )
}
