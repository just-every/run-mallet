import { Painting } from '../parts'

/** 09, no heading: Tuesday morning from the passenger seat of Priya's parked Odyssey, with the tag in the sky and the
 *  reminder on the phone in the dash mount set in type at their painted places (% of the painting). */
export function Interlude() {
  return (
    <section className="interlude" aria-label="Tuesday morning in Priya Shah's parked Odyssey">
      <div className="interlude-frame">
        <div className="interlude-scene">
          <Painting className="interlude-art" name="interlude" widths={[768, 1152, 1536]} sizes="max(100vw, 1190px)"
            phone={{ name: 'interlude-phone', widths: [778], media: '(max-width: 760px)', sizes: 'max(101vw, 603px)' }} />
          <p className="interlude-tag">Tue Oct 20 · Priya's Odyssey · 104,650 mi</p>
          <div className="interlude-screen">
            <p>Timing belt due at 105,000&nbsp;mi</p>
            <p className="interlude-price">$780.00</p>
            <span className="interlude-book">Book</span>
          </div>
        </div>
      </div>
    </section>
  )
}
