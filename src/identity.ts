// This edition's identity: what its installed Lobby and its run site say.
// The name and colour are the ones setup saves in src/branding.json; replace
// the purpose and tagline with the product's own when it has one.
import type { EditionIdentity } from './base/identity'
import branding from './branding.json'
import site from '../deploy-site.json'

export const identity: EditionIdentity = {
  product: branding.name,
  deployment: branding.name,
  purpose: '{deployment} keeps your shop’s repair orders, customer approvals and service history in your account.',
  tagline: 'Free, open source shop management for independent repair shops. Full bays, cars out on time.',
  signInPath: '/signin',
  // The run site `rer deploy --site` publishes (deploy-site.json).
  runSite: `https://${site.domain}`,
  // An installed instance serves the Lobby at /.
  installedHome: 'lobby',
  theme: '/rer-theme.css',
  // The faces and brand tokens, defined once for the site, the app and Base's pages.
  fonts: '/site/tokens.css',
  mark: '/brand/mark.svg',
  band: '/brand/band.svg',
  accentColor: branding.primaryColor,
}
