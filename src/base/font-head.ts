// Shared by the root renderer and the no-JavaScript first-run document.
// Edition owners can replace these self-hosted URLs with their brand assets.
// Mallet: rer-theme.css declares the Sofia Sans faces, so only the Latin files
// are preloaded; brand/frame.css carries Mallet's look onto Base's own pages.
export const fontLinks = [
  { rel: 'preload', href: '/fonts/sofia-sans/sofia-sans-latin-wght-normal.woff2', as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' },
  { rel: 'preload', href: '/fonts/sofia-sans/sofia-sans-semi-condensed-latin-wght-normal.woff2', as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' },
  { rel: 'stylesheet', href: '/brand/frame.css' },
] as const

export const fontHead = fontLinks.map(link => `<link ${Object.entries(link).map(([name, value]) => `${name.toLowerCase()}="${value}"`).join(' ')}>`).join('')
