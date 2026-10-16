import { RunActions } from '../shell/RunActions'
import { Board, Hung, Mallet, Tick } from './Pegboard'

const label = "Mallet's repair flow: an estimate of engine oil $68.00 and oil service $120.00, total $206.80; the customer Jordan Lee says yes to both lines by phone; invoice M-000001 is exported for $206.80."

/** The hero: the promise, the free line, the actions, and the 1-2-3 story hung on the pegboard. */
export function Hero() {
  return (
    <section id="top" className="hero">
      <div className="site-wrap">
        <h1>Repairs, exactly as agreed.</h1>
        <p className="hero-sub">Book it in, record the customer’s yes on each line, and hand over with one invoice.</p>
        <p className="hero-free">100% free, open source alternative to <strong>Shopmonkey</strong>, <strong>Tekmetric</strong> and <strong>RepairShopr</strong></p>
        <RunActions />
        <p className="hero-small">Free and open source, MIT licensed.</p>
        <Board className="hero-board" label={label}>
          <div className="hero-cards">
            <Hung className="step-card">
              <h3><span className="figure">1</span>Estimate</h3>
              <div className="inset">
                <p className="line"><span>Engine oil 5W-30</span><span className="fig">$68.00</span></p>
                <p className="line"><span>Oil service</span><span className="fig">$120.00</span></p>
                <p className="line total"><span>Total</span><span className="fig">$206.80</span></p>
              </div>
            </Hung>
            <Hung className="step-card">
              <h3><span className="figure">2</span>Customer says yes</h3>
              <div className="inset">
                <p className="line ticked"><Tick /><span>Engine oil 5W-30</span></p>
                <p className="line ticked"><Tick /><span>Oil service</span></p>
                <p className="line by"><span>Jordan Lee · by phone</span></p>
              </div>
            </Hung>
            <Hung className="step-card">
              <h3><span className="figure">3</span>Hand over</h3>
              <div className="inset">
                <p className="invoice-no">M-000001</p>
                <p><span className="pill">Exported</span></p>
                <p className="line total big"><span className="fig">$206.80</span></p>
              </div>
            </Hung>
          </div>
          <Mallet className="hero-mallet" />
        </Board>
      </div>
    </section>
  )
}
