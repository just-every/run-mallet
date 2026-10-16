import type { ReactNode } from 'react'

// The workshop pegboard the drawings hang on: tan hardboard with a hole grid (CSS), a screw in each corner, steel
// rings through each hung card, and the mallet in its painted red outline. Every string on it is real text.

/** A pegboard panel. `label` names the whole drawing for assistive technology; its parts stay selectable text. */
export function Board({ className = '', label, children }: { className?: string; label?: string; children?: ReactNode }) {
  return (
    <div className={`board ${className}`} {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}>
      <span className="screw tl" /><span className="screw tr" /><span className="screw bl" /><span className="screw br" />
      {children}
    </div>
  )
}

/** A steel ring through the top of a hung card. */
export function Ring({ className = '' }: { className?: string }) {
  return (
    <svg className={`ring ${className}`} viewBox="0 0 14 34" aria-hidden="true">
      <rect x="2.2" y="1.2" width="9.6" height="31.6" rx="4.8" fill="none" stroke="#5f5a54" strokeWidth="2.4" />
      <rect x="2.2" y="1.2" width="9.6" height="31.6" rx="4.8" fill="none" stroke="#c9c5bf" strokeWidth="1" transform="translate(-.6 -.4)" />
    </svg>
  )
}

/** A white card hung from two rings. */
export function Hung({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`hung ${className}`}><Ring className="left" /><Ring className="right" />{children}</div>
}

/** An empty hook, waiting for the next job. */
export function Hook({ className = '' }: { className?: string }) {
  return (
    <svg className={`hook ${className}`} viewBox="0 0 24 34" aria-hidden="true">
      <circle cx="6" cy="6" r="4.6" fill="#3b2a1a" />
      <path d="M6 6v14a8 8 0 0 0 16 0v-3" fill="none" stroke="#6e6962" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M5 6v14a8 8 0 0 0 9 7.9" fill="none" stroke="#d2cec8" strokeWidth="1" strokeLinecap="round" />
    </svg>
  )
}

/** The mallet hanging in its painted outline (public/brand/mallet.svg). */
export function Mallet({ className = '' }: { className?: string }) {
  return <span className={`mallet ${className}`}><img src="/brand/mallet.svg" alt="" width={160} height={300} /></span>
}

/** The red tick of an authorised line. */
export function Tick() {
  return <span className="tick" aria-hidden="true" />
}
