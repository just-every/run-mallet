import assert from 'node:assert/strict'

/** Consume only this roster member's accepted invitation in disposable mail. */
export default async function initialize({ request, origin, email, owner, mail }) {
 const post = token => request(origin + '/auth/confirm', { method: 'POST', redirect: 'manual',
  headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
 const people = await request(origin + '/auth/operators', { headers: { Cookie: owner.cookie } })
 assert.equal(people.status, 200)
 const { operators } = await people.json()
 const invited = operators.find(person => person.email === email)
 assert.equal(invited?.role, 'member')
 assert.equal(invited?.status, 'invited')
 const messages = mail.read({ limit: 1 })
 assert.equal(messages.length, 1, 'signed roster sent a native member invitation')
 const link = new URL(messages[0].text.match(/https:\/\/[^\s]+/)[0])
 assert.equal(link.origin, origin)
 assert.equal(link.pathname, '/auth/confirm')
 const invalid = await post(crypto.randomUUID())
 assert.equal(invalid.status, 400)
 await invalid.body?.cancel()
 const response = await post(link.searchParams.get('token'))
 assert.equal(response.status, 303)
 const cookie = response.headers.getSetCookie().map(value => value.split(';', 1)[0]).join('; ')
 assert.ok(cookie && cookie !== owner.cookie)
 const session = await request(origin + '/auth/session', { headers: { Cookie: cookie } })
 assert.equal(session.status, 200)
 const { operator } = await session.json()
 assert.equal(operator.id, invited.id)
 assert.equal(operator.role, 'member')
 const replay = await post(link.searchParams.get('token'))
 assert.equal(replay.status, 400)
 await replay.body?.cancel()
 console.log('PROBE BASE-AGENT-004 native-lifecycle: signed roster -> ordinary native member; confirmation 303; invalid and replayed proof 400')
 return response
}
