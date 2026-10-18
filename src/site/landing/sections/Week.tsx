import { SectionHead } from '../parts'
import { shop, week } from '../record'

/** 11: Saturday's emailed weekly report, a document rather than a dashboard. */
export function Week() {
  return (
    <section className="band" aria-labelledby="week-title">
      <div className="site-wrap">
        <SectionHead className="center" id="week-title" eyebrow="Week of Oct 19 – 23" title={`${week.cars} cars at a ${week.aro} ARO.`} lead="Every number opens the repair orders behind it." />
        <article className="card report" aria-label={`Weekly report for ${shop.name}`}>
          <header><h3>Weekly report · {shop.name}</h3><p>Sent Sat Oct 24, 7:00 am</p></header>
          <dl className="figures">
            <div><dt>Car count</dt><dd>{week.cars}</dd></div>
            <div><dt>ARO</dt><dd>{week.aro}</dd></div>
            <div><dt>Sales</dt><dd>{week.sales}</dd></div>
            <div><dt>On promise</dt><dd>{week.onPromise}</dd></div>
          </dl>
          <p className="by-day">Cars by day{week.carsByDay.map(([day, n]) => <span key={day}> · {day} {n}</span>)} · {week.movedAhead} promises moved ahead of time, customers told</p>
          <h4>Technicians</h4>
          <div className="report-table" role="region" aria-label="Technician hours" tabIndex={0}>
            <table>
              <thead><tr><th>Technician</th><th>Sold hrs</th><th>Clocked hrs</th><th>Efficiency</th></tr></thead>
              <tbody>
                {week.techs.map(t => <tr key={t.name}><td>{t.name}</td><td>{t.sold}</td><td>{t.clocked}</td><td>{t.efficiency}</td></tr>)}
              </tbody>
              <tfoot><tr><td>Shop</td><td>{week.shop.sold}</td><td>{week.shop.clocked}</td><td>{week.shop.efficiency}</td></tr></tfoot>
            </table>
          </div>
          <p className="report-foot">Labor {week.labor} · Parts and fees {week.parts} · Declined work booked back {week.bookedBack}</p>
        </article>
      </div>
    </section>
  )
}
