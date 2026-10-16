// The "Also included" tile icons: ink line drawings, at most one workshop-red detail each.
const ink = { fill: 'none', stroke: '#1a1714', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
const red = { ...ink, stroke: '#b4231c' } as const

const icons = {
  revisions: <><path {...ink} d="M9 4h11l5 5v17a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" /><path {...ink} d="M20 4v5h5M11 13h9M11 17h6" /><path {...red} d="M14 24.5a4.5 4.5 0 1 1 4.5 1.5M14 21v3.5h3.5" /></>,
  roles: <><circle {...ink} cx="16" cy="10" r="3.5" /><circle {...ink} cx="7.5" cy="13" r="2.8" /><circle {...ink} cx="24.5" cy="13" r="2.8" /><path {...ink} d="M9.5 26v-2.5a6.5 6.5 0 0 1 13 0V26M3 25v-1.5a4.5 4.5 0 0 1 6-4.2M29 25v-1.5a4.5 4.5 0 0 0-6-4.2" /></>,
  agent: <><path {...ink} d="M8 4h11l5 5v17a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" /><path {...ink} d="M19 4v5h5M10 12h8M10 16h5" /><circle {...red} cx="20" cy="22" r="2.6" /><path {...red} d="M20 16.8v1.6M20 25.6v1.6M14.8 22h1.6M23.6 22h1.6M16.3 18.3l1.1 1.1M22.6 24.6l1.1 1.1M16.3 25.7l1.1-1.1M22.6 19.4l1.1-1.1" /></>,
  movein: <><path {...ink} d="M14 6h11a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H14" /><path {...ink} d="M4 16h14" /><path {...red} d="M13 11l5 5-5 5" /></>,
  backup: <><ellipse {...ink} cx="16" cy="7.5" rx="9" ry="3.5" /><path {...ink} d="M7 7.5v17c0 1.9 4 3.5 9 3.5s9-1.6 9-3.5v-17M7 13.2c0 1.9 4 3.5 9 3.5s9-1.6 9-3.5M7 18.9c0 1.9 4 3.5 9 3.5s9-1.6 9-3.5" /></>,
  approval: <><path {...ink} d="M8 4h11l5 5v6M24 25v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" /><path {...ink} d="M19 4v5h5M10 12h8M10 16h5" /><circle {...red} cx="22.5" cy="21.5" r="5.5" /><path {...red} d="M20 21.6l1.8 1.8 3.2-3.4" /></>,
}

export type IconName = keyof typeof icons

export function Icon({ name }: { name: IconName }) {
  return <svg className="icon" viewBox="0 0 32 32" aria-hidden="true">{icons[name]}</svg>
}
