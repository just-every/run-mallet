import type { ReactNode } from 'react'
import { Board, Hook, Hung, Mallet, Tick } from './Pegboard'
import { Icon, type IconName } from './icons'
import { RunActions } from '../shell/RunActions'

/** One band: a heading, one or two short lines, and one small drawing; drawings alternate sides on wide screens. */
function Band({ id, title, body, art, flip = false, label, className = '' }: { id: string; title: string; body?: string; art: ReactNode; flip?: boolean; label: string; className?: string }) {
  return (
    <section id={id} className={`band${flip ? ' flip' : ''} ${className}`}>
      <div className="site-wrap band-in">
        <div className="band-copy"><h2>{title}</h2>{body ? <p>{body}</p> : null}</div>
        <Board className="band-board" label={label}>{art}</Board>
      </div>
    </section>
  )
}

const tiles: [IconName, string][] = [
  ['revisions', 'Exact estimate revisions'], ['roles', 'Roles for your team'], ['agent', 'Agent-prepared estimates'],
  ['movein', 'Move in from RepairShopr'], ['backup', 'Backup and restore'], ['approval', 'Approval record'],
]

export function Sections() {
  return (
    <>
      <Band id="free" title="100% free." body="Free as in code, free as in cost. MIT licensed." label="A hung card reading MIT License." className="square"
        art={<Hung className="licence"><h3>MIT License</h3><span className="lines" aria-hidden="true"><i /><i /><i /><i /></span></Hung>} />
      <Band id="authorise" flip title="Every line, their call." body="Share the estimate, then record which lines the customer says yes to and how they said it. The invoice follows their choice."
        label="An estimate: engine oil 5W-30 authorised, oil service authorised, front brake pads declined; authorised total $206.80 including GST."
        art={<Hung className="estimate">
          <p className="head"><span>Item</span><span>Customer choice</span></p>
          <p className="row"><span>Engine oil 5W-30</span><span className="yes"><Tick />Authorised</span></p>
          <p className="row"><span>Oil service</span><span className="yes"><Tick />Authorised</span></p>
          <p className="row"><span>Front brake pads</span><span className="no">Declined</span></p>
          <p className="sum">Authorised total: $206.80 including GST.</p>
        </Hung>} />
      <Band id="bays" title="No double-booked bays." body="Choose the bay, technician and time. Mallet refuses a booking that overlaps either." className="strip"
        label="Two bookings: Bay 1, Sam Patel, 9:00 to 11:00; Bay 2, Alex Nguyen, 9:00 to 10:00."
        art={<div className="bookings">
          <Hung className="booking"><strong>Bay 1</strong> · Sam Patel · 9:00 – 11:00</Hung>
          <Hung className="booking"><strong>Bay 2</strong> · Alex Nguyen · 9:00 – 10:00</Hung>
        </div>} />
      <Band id="history" flip title="Every visit, one history." body="Each vehicle, bicycle or device keeps every visit. Download its service history as a CSV."
        label="A 2017 Toyota Corolla, YJD 482, owned by Jordan Lee: oil service invoiced, front brake pads booked, and a service history CSV download."
        art={<Hung className="asset">
          <h3>2017 Toyota Corolla</h3>
          <p className="meta">YJD 482 · Jordan Lee</p>
          <p className="row"><span>Oil service</span><span className="pill">invoiced</span></p>
          <p className="row"><span>Front brake pads</span><span className="pill">booked</span></p>
          <p className="fake-link">Download service history CSV</p>
        </Hung>} />
      <Band id="invoice" title="One invoice, exported once." body="Approve it, export it, and every later download is the same saved CSV, with GST shown separately."
        label="Handover invoice M-000001, exported: subtotal $188.00, GST $18.80, total $206.80 AUD, with a saved invoice CSV download."
        art={<Hung className="invoice">
          <p className="kicker">Handover invoice</p>
          <p className="number"><span>M-000001</span><span className="pill">Exported</span></p>
          <p className="meta">Subtotal $188.00 · GST $18.80</p>
          <p className="grand">Total $206.80 AUD</p>
          <p className="fake-link">Download saved invoice CSV</p>
        </Hung>} />
      <Band id="included" flip title="Also included" className="included"
        label="Also included: exact estimate revisions, roles for your team, agent-prepared estimates, move in from RepairShopr, backup and restore, approval record."
        art={<ul className="tiles">{tiles.map(([icon, text]) => <li key={icon}><Hung className="tile"><Icon name={icon} /><span>{text}</span></Hung></li>)}</ul>} />
      <section id="run" className="closing">
        <div className="site-wrap">
          <h2>Run it beside what you have.</h2>
          <p>Book your next job through Mallet. Keep everything else as it is.</p>
          <RunActions />
          <Board className="closing-board"><Hook className="h1" /><Hook className="h2" /><Hook className="h3" /><Mallet className="closing-mallet" /></Board>
        </div>
      </section>
    </>
  )
}
