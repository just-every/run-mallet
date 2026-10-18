import { Done, Painting } from '../parts'

/** 09, no heading: Clintonville in the hero's painted style as the day's cars go home, with one tag set in type. */
export function Interlude() {
  return (
    <section className="interlude" aria-label="Monday at Buckeye Auto Repair: 21 cars out, 21 on promise">
      <div className="interlude-frame">
        <div className="interlude-scene">
          <Painting className="interlude-art" name="interlude" widths={[768, 1152, 1536]} sizes="max(100vw, 640px)" />
          <p className="interlude-tag">Mon Oct 19 · 21 cars out · 21 on promise <Done /></p>
        </div>
      </div>
    </section>
  )
}
