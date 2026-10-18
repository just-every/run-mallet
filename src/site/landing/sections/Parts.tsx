import { Dot, SectionHead, Tick } from '../parts'
import { ro } from '../record'

const steps = [
  { time: '9:41 am', note: 'Worldpac backorder notice', tone: 'red' },
  { time: '9:44 am', note: '2 options ready', tone: 'cyan' },
  { time: '9:50 am', note: 'Kayla approved the order', tone: 'cyan' },
  { time: '9:52 am', note: 'Revised line texted to Dana', tone: 'cyan' },
  { time: '10:05 am', note: <>Dana re-approved <Tick /></>, tone: 'green' },
  { time: '11:20 am', note: `Pads received · scanned to ${ro.number}`, tone: 'green' },
] as const

/** 06, the one dark band: Worldpac backorders the pads, the agent finds them nearby and the 5:00 promise holds. */
export function Parts() {
  return (
    <section className="band plum" aria-labelledby="parts-title">
      <div className="site-wrap">
        <div className="split parts">
          <SectionHead id="parts-title" eyebrow="Parts · 9:41 am" title={<>Pads backordered. <span className="keep">Promise still 5:00.</span></>}
            lead="The agent finds pads in stock nearby, reprices the line and checks Bay 3’s afternoon. Dana re-approves by text." />
          <div className="parts-cards">
            <article className="card supplier failed">
              <h3>Worldpac · front ceramic pads</h3>
              <p className="status red"><Dot tone="red" />Backordered · ETA Wed Oct 21</p>
              <p className="muted">Ready Wed 3:00 pm · misses promise</p>
            </article>
            <article className="card supplier chosen">
              <h3>Morse Rd supplier · via PartsTech</h3>
              <p className="status green"><Dot tone="green" />In stock · delivery 11:15 am</p>
              <dl className="rows tight">
                <div><dt>Pads <b>{ro.padsMorseRd}</b> <span className="muted">(was {ro.padsWorldpac})</span></dt><dd>{ro.padsDelta}</dd></div>
                <div><dt>Front brakes now</dt><dd>{ro.brakesNow}</dd></div>
              </dl>
              <p className="pill green wide">Est. ready 4:15 pm · promise 5:00 holds <Tick /></p>
            </article>
          </div>
        </div>
        <p className="parts-day" aria-hidden="true">Mon Oct 19</p>
        <div className="parts-track">
        <ol className="parts-line">
          {steps.map(step => (
            <li key={step.time} className={step.tone}><span className="node" aria-hidden="true" /><strong>{step.time}</strong><span>{step.note}</span></li>
          ))}
        </ol>
        <p className="parts-result"><strong>Customer promise changed: no</strong><span>Bay 3 at 1:40 pm · ready 4:10 pm <Tick /></span></p>
        </div>
      </div>
    </section>
  )
}
