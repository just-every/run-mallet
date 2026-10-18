import type { ReactNode } from 'react'
import { Dot, SectionHead, Tablet, evidence } from '../parts'
import { ro } from '../record'

const findings: { tone: 'red' | 'amber'; item: string; reading: string; photo: ReactNode }[] = [
  { tone: 'red', item: 'Front brake pads', reading: '2 mm · rotors scored', photo: evidence.rotor },
  { tone: 'red', item: 'Brake fluid', reading: '3.5% moisture', photo: evidence.strip },
  { tone: 'amber', item: 'Cabin air filter', reading: 'Dirty · 12,300 mi since change', photo: evidence.filter },
  { tone: 'amber', item: 'Rear tires', reading: '4/32 in', photo: evidence.tread },
  { tone: 'amber', item: 'Battery', reading: '68% health', photo: evidence.battery },
]

/** 04: Luis's tablet inspection, every red and yellow item with its reading and evidence, and Dana's 9:12 text. */
export function Inspect() {
  return (
    <section className="band alt" aria-labelledby="inspect-title">
      <div className="site-wrap split inspect">
        <SectionHead id="inspect-title" eyebrow="Inspect · 8:40 – 9:12 am" title={<>Measured, <br className="wide" />photographed, <br className="wide" />texted.</>}
          lead="Luis inspects 39 points on a tablet. Every red and yellow item carries a measurement and a photo." />
        <div className="inspect-stage">
          <Tablet className="dvi">
            <p className="dvi-title">{ro.number} · {ro.vehicle} · {ro.tech}</p>
            <p className="dvi-meta">Test drive {ro.testDrive} · squeal confirmed</p>
            <p className="dvi-counts"><span className="chip"><Dot tone="red" />2 red</span><span className="chip"><Dot tone="amber" />3 yellow</span><span className="chip"><Dot tone="green" />34 green</span></p>
            <ul className="dvi-rows">
              {findings.map(f => (
                <li key={f.item}><span className="dvi-photo">{f.photo}</span><Dot tone={f.tone} /><p><span>{f.item}</span><strong>{f.reading}</strong></p></li>
              ))}
            </ul>
          </Tablet>
          <article className="bubble" aria-label="The text Dana received at 9:12 am">
            <p className="bubble-from">Buckeye Auto Repair · 9:12 am</p>
            <div className="bubble-body">
              <p>Hi Dana, your CR-V inspection is ready. 2 items need attention now and 3 to watch. Photos and prices here:</p>
              <p className="bubble-button">View inspection</p>
            </div>
            <p className="bubble-from">Delivered 9:12 · opened 9:19</p>
          </article>
        </div>
      </div>
    </section>
  )
}
