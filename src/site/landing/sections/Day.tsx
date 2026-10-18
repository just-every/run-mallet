import { SectionHead, Tick } from '../parts'
import { ro } from '../record'

const stops = [
  { stage: 'Check-in', time: '7:41 am', lines: ['Key drop · mobile check-in', `VIN decoded · ${ro.milesIn}`] },
  { stage: 'Inspect', time: '9:12 am', lines: ['2 red, 3 yellow', `Texted to ${ro.customer}`] },
  { stage: 'Approve', time: '9:24 am', lines: [<>Front brakes {ro.brakesFirst} <Tick /></>, 'Cabin filter declined'] },
  { stage: 'Parts', time: '9:41 am', lines: ['Pads backordered at Worldpac', <>PartsTech, re-approved 10:05 <Tick /></>], alert: true },
  { stage: 'Work', time: '1:40 pm', lines: [`Bay 3 · ${ro.tech}`, <>{ro.laborHours} hrs sold · ready 4:10 <Tick /></>] },
  { stage: 'Pay', time: '4:18 pm', lines: [`Paid by text · ${ro.total}`, <>Collected 4:30 <Tick /></>], done: true },
]

/** 02: the day at a glance, one card with RO 4127's six stops, so a stranger knows the page follows one real car. */
export function Day() {
  return (
    <section className="band alt" aria-labelledby="day-title">
      <div className="site-wrap">
        <SectionHead id="day-title" eyebrow={`${ro.number} · Mon Oct 19`} title="7:41 drop-off. 4:30 pickup." lead={`One customer’s CR-V through every stage of a Monday at the shop.`} />
        <div className="card day-card">
          <ol className="day-line">
            {stops.map(stop => (
              <li key={stop.stage} className={stop.alert ? 'is-alert' : stop.done ? 'is-paid' : undefined}>
                <span className="day-node" aria-hidden="true" />
                <p className="day-stage">{stop.stage}</p>
                <p className="day-time">{stop.time}</p>
                {stop.lines.map((line, i) => <p key={i} className="day-note">{line}</p>)}
              </li>
            ))}
          </ol>
          <div className="day-foot">
            <p>{ro.customer} · 2019 Honda CR-V EX · advisor {ro.advisor}</p>
            <p className="pill green">Promise 5:00 pm · kept <Tick /></p>
          </div>
        </div>
      </div>
    </section>
  )
}
