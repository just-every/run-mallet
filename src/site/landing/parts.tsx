import type { ReactNode } from 'react'

// Shared pieces of the homepage: the painted scenes, section heads, ticks and status dots, the phone and tablet
// frames the product screens sit in, and the flat line drawings used as inspection evidence.

/** A painted scene from public/site as AVIF with a WebP fallback, at every width it was exported; `phone` swaps in a crop. */
export function Painting({ name, widths, sizes, alt = '', eager = false, className, phone }: { name: string; widths: number[]; sizes: string; alt?: string; eager?: boolean; className?: string; phone?: { name: string; widths: number[]; media: string; sizes: string } }) {
  const set = (type: string, file = name, list = widths) => list.map(w => `/site/${file}-${w}.${type} ${w}w`).join(', ')
  const largest = widths[widths.length - 1]
  return (
    <picture className={className}>
      {phone ? ['avif', 'webp'].map(type => <source key={type} media={phone.media} type={`image/${type}`} srcSet={set(type, phone.name, phone.widths)} sizes={phone.sizes} />) : null}
      <source type="image/avif" srcSet={set('avif')} sizes={sizes} />
      <img src={`/site/${name}-${largest}.webp`} srcSet={set('webp')} sizes={sizes} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" fetchPriority={eager ? 'high' : undefined} />
    </picture>
  )
}

/** The stage-and-time eyebrow every section carries, then its heading and lead. */
export function SectionHead({ eyebrow, title, lead, id, className }: { eyebrow: string; title: ReactNode; lead?: ReactNode; id: string; className?: string }) {
  return (
    <header className={`section-head ${className ?? ''}`}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id}>{title}</h2>
      {lead ? <p className="lead">{lead}</p> : null}
    </header>
  )
}

export const Tick = ({ className = 'tick' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.4 6.6 11.3 12.6 4.9" /></svg>
)

/** A filled round tick: done. */
export const Done = () => (
  <svg className="done" viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="11" /><path d="M6.4 11.3 9.6 14.3 15.7 7.9" /></svg>
)

export const Dot = ({ tone }: { tone: 'red' | 'amber' | 'green' | 'cyan' | 'grey' }) => <span className={`dot ${tone}`} aria-hidden="true" />

export const Arrow = () => <span className="arrow" aria-hidden="true">→</span>

/** A phone in plain hardware: the status bar shows the time the screen happens at. */
export function Phone({ time, children, className }: { time: string; children: ReactNode; className?: string }) {
  return (
    <div className={`phone ${className ?? ''}`}>
      <div className="phone-screen">
        <p className="phone-status"><span>{time}</span><span className="phone-island" aria-hidden="true" /><span className="phone-signal" aria-hidden="true"><i /><i /><i /><i /></span></p>
        {children}
        <span className="phone-home" aria-hidden="true" />
      </div>
    </div>
  )
}

export function Tablet({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`tablet ${className ?? ''}`}><span className="tablet-camera" aria-hidden="true" /><div className="tablet-screen">{children}</div></div>
}

/** Initials in a tinted circle: technicians, advisors and customers. */
export const Avatar = ({ initials, tone }: { initials: string; tone: 'cyan' | 'violet' | 'green' | 'red' | 'teal' | 'grey' | 'peach' | 'blue' }) => (
  <span className={`avatar ${tone}`} aria-hidden="true">{initials}</span>
)

// Inspection evidence, drawn flat: on the homepage these stand in for the technician's photos.
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export const evidence = {
  rotor: (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="34" cy="32" r="22" fill="#c9ced6" />
      <circle cx="34" cy="32" r="22" fill="none" stroke="#9aa1ad" strokeWidth="1.5" />
      <path d="M20 22c6 4 22 2 28 8M18 34c8 2 24 1 32 6M22 44c6-2 16 0 22 2" fill="none" stroke="#a7aeb9" strokeWidth="1.2" />
      <circle cx="34" cy="32" r="9" fill="#e6e9ee" stroke="#9aa1ad" strokeWidth="1.5" />
      <circle cx="34" cy="32" r="3" fill="#7f8794" />
      <path d="M8 18c-3 4-4 9-4 14s1 10 4 14l9-4c-2-3-3-6-3-10s1-7 3-10z" fill="#3a3f4a" />
      <path d="M41 25l3-3M43 30h4M40 38l3 3" stroke="#6f7784" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  strip: (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <rect x="27" y="6" width="10" height="52" rx="2" fill="#f4f1ea" stroke="#b9b2a3" strokeWidth="1.2" />
      <rect x="27" y="14" width="10" height="8" fill="#e7c86b" />
      <rect x="27" y="26" width="10" height="8" fill="#b9874a" />
      <rect x="27" y="38" width="10" height="8" fill="#8e5c38" />
      <path d="M44 14h8M44 30h8M44 42h8" stroke="#9aa1ad" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="16" cy="30" r="5" fill="#e0383b" />
      <text x="16" y="49" textAnchor="middle" fontSize="8" fontWeight="700" fill="#5b5866" fontFamily="Inter,Arial,sans-serif">3.5%</text>
    </svg>
  ),
  filter: (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <rect x="10" y="12" width="44" height="40" rx="3" fill="#d9dde3" stroke="#6f7784" strokeWidth="1.5" />
      <path d="M16 15v34M21 15v34M26 15v34M31 15v34M36 15v34M41 15v34M46 15v34M51 15v34" stroke="#8a919c" strokeWidth="1.4" />
      <ellipse cx="34" cy="34" rx="12" ry="10" fill="#9b7b4c" opacity=".55" />
      <ellipse cx="30" cy="30" rx="6" ry="5" fill="#7a5a32" opacity=".5" />
    </svg>
  ),
  tread: (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <rect x="6" y="30" width="52" height="24" rx="4" fill="#3a3f4a" />
      <path d="M14 30v24M24 30v24M34 30v24M44 30v24" stroke="#5b6270" strokeWidth="3" />
      <rect x="28" y="6" width="8" height="34" rx="2" fill="#f6b40e" stroke="#b07f00" strokeWidth="1.2" />
      <path d="M28 14h4M28 20h6M28 26h4M28 32h6" stroke="#7a5200" strokeWidth="1.2" />
      <text x="48" y="22" textAnchor="middle" fontSize="8" fontWeight="700" fill="#5b5866" fontFamily="Inter,Arial,sans-serif">4/32</text>
    </svg>
  ),
  battery: (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <rect x="8" y="22" width="48" height="32" rx="3" fill="#3a3f4a" />
      <rect x="15" y="17" width="9" height="6" rx="1" fill="#6f7784" />
      <rect x="40" y="17" width="9" height="6" rx="1" fill="#6f7784" />
      <rect x="16" y="30" width="32" height="14" rx="2" fill="#dff3e6" />
      <text x="32" y="41" textAnchor="middle" fontSize="10" fontWeight="700" fill="#0b7a3e" fontFamily="Inter,Arial,sans-serif">68%</text>
    </svg>
  ),
  suv: (
    <svg viewBox="0 0 72 40" aria-hidden="true">
      <path d="M6 28v-5c0-2 1-3 3-4l9-2 9-8c1-1 3-2 5-2h18c2 0 3 1 4 2l7 8 3 1c2 1 3 2 3 4v6c0 1-1 2-2 2H8c-1 0-2-1-2-2z" fill="#f4f6f9" stroke="#8d939e" strokeWidth="1.4" />
      <path d="M22 17l7-6c1-1 2-1 3-1h8v7zM43 10h6c1 0 2 0 3 1l5 6H43z" fill="#9cc6dc" />
      <circle cx="20" cy="30" r="6" fill="#2f333b" /><circle cx="20" cy="30" r="2.4" fill="#c9ced6" />
      <circle cx="54" cy="30" r="6" fill="#2f333b" /><circle cx="54" cy="30" r="2.4" fill="#c9ced6" />
    </svg>
  ),
}

/** Line icons for the hero's cards: a parts box, a wrench, a card reader. */
export const icons = {
  box: <svg viewBox="0 0 32 32" aria-hidden="true"><path {...stroke} d="M16 4 27 9.5v13L16 28 5 22.5v-13zM5 9.5 16 15l11-5.5M16 15v13M10.5 6.8l11 5.5" /></svg>,
  wrench: <svg viewBox="0 0 32 32" aria-hidden="true"><path {...stroke} d="M20.5 4.5a6.5 6.5 0 0 0-6 9L5.4 22.6a2.5 2.5 0 0 0 3.5 3.5l9.1-9.1a6.5 6.5 0 0 0 8.6-7.9l-3.9 3.9-3.6-1-1-3.6 3.9-3.9a6.5 6.5 0 0 0-1.5 0z" /></svg>,
  card: <svg viewBox="0 0 32 32" aria-hidden="true"><rect {...stroke} x="4" y="8" width="24" height="17" rx="2.5" /><path {...stroke} d="M4 13h24M8 20h6" /></svg>,
}
