import { Actions } from '../../shell/Actions'
import { Painting } from '../parts'

/** 13: "Keys back by five." in the empty sky above Dana's walk from her CR-V to the porch, with the licence line and the actions set in type. */
export function Closing() {
  return (
    <section className="closing" aria-labelledby="closing-title">
      <Painting className="closing-art" name="closing" widths={[768, 1152, 1536]} sizes="100vw"
        phone={{ name: 'closing-phone', widths: [780], media: '(max-width: 860px)', sizes: '100vw' }} />
      <div className="closing-copy">
        <h2 id="closing-title">Keys back by five.</h2>
        <p>100% free and open source. MIT licensed.</p>
        <Actions demo={false} />
      </div>
    </section>
  )
}
