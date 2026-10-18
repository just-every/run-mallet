import { Avatar, Dot, SectionHead, Tick } from '../parts'
import { ro, week } from '../record'

/** 10: Tuesday's follow-up queue, declined work brought back at the right mileage, and a failed text sent by email. */
export function FollowUp() {
  return (
    <section className="band alt" aria-labelledby="follow-title">
      <div className="site-wrap split follow">
        <article className="card queue" aria-label="Follow-ups for Tuesday, October 20">
          <h3>Follow-ups · Tue Oct 20</h3>
          <ul>
            <li>
              <Avatar initials="PS" tone="blue" />
              <div><p className="who">Priya Shah · 2013 Honda Odyssey</p><p>Timing belt declined Jun 3 at 101,200 mi · due at 105,000 mi</p><p>Replied 104,650 mi · quote refreshed $780.00</p></div>
              <p className="pill green">Booked Mon Oct 26, 8:00 am <Tick /></p>
            </li>
            <li>
              <Avatar initials="MH" tone="violet" />
              <div><p className="who">Marcus Hill · 2021 Toyota RAV4</p><p>Oil service due at 45,000 mi</p></div>
              <p className="pill green">Booked Thu Oct 22, 8:00 am <Tick /></p>
            </li>
            <li>
              <Avatar initials="TA" tone="peach" />
              <div><p className="who">Tom Avery · 2015 Ford Escape</p><p>Rear brakes declined Aug 18</p><p className="failed"><span><Dot tone="red" /> Text failed · landline</span><span><span className="to">→</span> emailed 9:02 am</span></p></div>
              <p className="pill green">Approved 2:05 pm <Tick /></p>
            </li>
            <li>
              <Avatar initials="DB" tone="green" />
              <div><p className="who">{ro.customer} · {ro.vehicle}</p><p>Cabin air filter declined Oct 19 at {ro.milesIn} · due at {ro.filterDue}</p></div>
              <p className="pill grey">Not due · no message</p>
            </li>
            <li>
              <Avatar initials="GP" tone="blue" />
              <div><p className="who">Greg Paulsen · 2010 Jeep Liberty</p><p>Vehicle sold</p></div>
              <p className="pill grey">Reminders stopped</p>
            </li>
          </ul>
          <p className="queue-week">Week of Oct 19 – 23: {week.followUps} follow-ups · {week.booked} booked · {week.bookedBack} back on the board</p>
        </article>
        <SectionHead id="follow-title" eyebrow="Follow-up · Tue Oct 20" title={<>Back when <br className="wide" />the miles <br className="wide" />say so.</>}
          lead="The agent tracks declined work and service intervals by mileage, refreshes each price and drafts the text for Kayla to send." />
      </div>
    </section>
  )
}
