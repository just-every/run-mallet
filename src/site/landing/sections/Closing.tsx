import { Actions } from '../../shell/Actions'
import { Painting } from '../parts'

/** 13: "Keys back by five." over the sky above Dana's porch, with the licence line and the actions set in type. */
export function Closing() {
  return (
    <section className="closing" aria-labelledby="closing-title">
      <Painting className="closing-art" name="closing" widths={[768, 1152, 1536]} sizes="max(100vw, 760px)" />
      <div className="closing-copy">
        <h2 id="closing-title">Keys back by five.</h2>
        <p>100% free and open source. MIT licensed.</p>
        <Actions demo={false} />
      </div>
    </section>
  )
}
