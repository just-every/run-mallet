import assert from 'node:assert/strict'
import {nativeDoor,seedRepair} from './preparation-fixtures.mjs'

/** Native setup-token bootstrap and real workshop fixtures, through production requests only. */
export default async function initialize({ request, origin, token, displayName, reviewers }) {
 const bootstrap = await request(origin + '/auth/bootstrap', { method: 'POST', redirect: 'manual',
  headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ token, displayName, returnTo: '/setup' }) })
 assert.equal(bootstrap.status, 303, 'native setup-token bootstrap')
 console.log('Native setup-token bootstrap: HTTP 303')
 const cookie = bootstrap.headers.getSetCookie().map(value => value.split(';', 1)[0]).join('; ')
 const setup = await request(origin + '/setup', { method: 'POST', redirect: 'manual', headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ confirm: 'yes', displayName, ratePercent: '10', partsTaxable: 'on', laborTaxable: 'on' }) })
 assert.equal(setup.status, 303, 'native first-run setup')
 console.log('Native first-run setup: HTTP 303')
 await setup.body?.cancel()
 const reviewer = await reviewers.initialize('quality', { cookie })
 const door=nativeDoor({request,origin,cookie})
 for(let i=0;i<4;i++)await seedRepair(door,i,reviewer)
 console.log('Native owner lifecycle: setup-token /auth/bootstrap; first-run tax and four real workshop fixtures created through public doors.')
 return bootstrap
}
