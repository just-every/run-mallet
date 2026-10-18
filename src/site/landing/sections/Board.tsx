import { Avatar, Dot, SectionHead } from '../parts'
import { ro } from '../record'

type Stage = 'work' | 'qc' | 'approval' | 'next'
const bays: { bay: string; who: string; initials: string; tone: Parameters<typeof Avatar>[0]['tone']; ro: string; car: string; job: string; stage: Stage; label: string; facts: [string, string][]; current?: boolean }[] = [
  { bay: 'Bay 1', who: 'Andre Wallace', initials: 'AW', tone: 'cyan', ro: 'RO 4129', car: '2017 Ford F-150', job: 'Rear brakes', stage: 'work', label: 'In work', facts: [['Promise', '3:00 pm'], ['Clock', '0:52']] },
  { bay: 'Bay 2', who: 'Mei Lin', initials: 'ML', tone: 'violet', ro: 'RO 4125', car: '2020 Toyota Camry', job: '60,000 mi service', stage: 'qc', label: 'Quality check', facts: [['Promise', '2:00 pm']] },
  { bay: 'Bay 3', who: ro.tech, initials: 'LR', tone: 'green', ro: ro.number, car: ro.vehicle, job: 'Front brakes', stage: 'work', label: 'In work', facts: [['Promise', '5:00 pm'], [`${ro.laborHours} hrs sold · clock`, '0:05']], current: true },
  { bay: 'Bay 4', who: 'Jake Kowalski', initials: 'JK', tone: 'red', ro: 'RO 4130', car: '2014 Chevrolet Equinox', job: 'Check engine · P0420', stage: 'approval', label: 'Waiting approval', facts: [['Texted', '1:20 pm']] },
  { bay: 'Bay 5', who: 'Chris Novak', initials: 'CN', tone: 'teal', ro: 'RO 4132', car: '2018 Nissan Rogue', job: 'Oil and tire rotation', stage: 'work', label: 'In work', facts: [['Promise', '2:30 pm']] },
  { bay: 'Bay 6', who: 'Alignment rack', initials: '– –', tone: 'grey', ro: 'RO 4133', car: '2021 Subaru Outback', job: 'Four-wheel alignment', stage: 'next', label: 'Next · Mei at 2:15 pm', facts: [] },
]

/** 07: the technician board at 1:45 pm, six bays with stage, promise and clock, the waiting-parts car and the next blocker. */
export function Board() {
  return (
    <section className="band alt" aria-labelledby="board-title">
      <div className="site-wrap">
        <div className="board-head">
          <SectionHead id="board-title" eyebrow="Technician board · 1:45 pm" title="Six bays on one board." />
          <p className="lead">Every car’s stage, promise and clock, live. Technicians start and stop jobs from the bay.</p>
        </div>
        <p className="board-filters" aria-hidden="true"><span className="on">All 6</span><span>In work 3</span><span>Waiting 1</span></p>
        <ul className="bays">
          {bays.map(b => (
            <li key={b.bay} className={`card bay${b.current ? ' current' : ''}`}>
              <p className="bay-name">{b.bay}</p>
              <p className="bay-who"><Avatar initials={b.initials} tone={b.tone} /><span>{b.who}</span></p>
              <p className="bay-ro">{b.ro} · {b.car}</p>
              <p className="bay-job">{b.job}</p>
              <p className={`stage st-${b.stage}`}>{b.label}</p>
              {b.facts.map(([k, v]) => <p key={k} className="bay-fact">{k} <b>{v}</b></p>)}
            </li>
          ))}
        </ul>
        <div className="board-notes">
          <article className="card note">
            <Dot tone="amber" />
            <h3>Waiting parts · RO 4134 · 2016 Jeep Wrangler</h3>
            <p>Water pump · Worldpac ETA Tue 9:00 am</p>
            <p>Promise moved to Tue 12:00 pm · customer told 10:40 am.</p>
          </article>
          <article className="card note">
            <p className="note-agent"><Dot tone="cyan" />Agent</p>
            <h3>Next blocker · RO 4130</h3>
            <p>Estimate texted 1:20 pm, not opened.</p>
            <p>Ben Carter calls at 2:00 pm.</p>
          </article>
        </div>
        <p className="board-clock">{ro.tech} · clocked in 7:28 am · 6.1 hrs sold today</p>
      </div>
    </section>
  )
}
