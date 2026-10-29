import assert from 'node:assert/strict'

/** The verifier captures only this declared person's accepted invitation mail. */
export default async function initialize({ request, origin, email, owner, mail }) {
 const post = (path, body, cookie) => request(origin + path, { method: 'POST', redirect: 'manual',
  headers: { Origin: origin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) })
 const invitation = await post('/auth/invite', { email, displayName: 'Cedar Independent Reviewer', role: 'admin' }, owner.cookie)
 assert.equal(invitation.status, 202)
 await invitation.body?.cancel()
 const messages = mail.read({ limit: 1 })
 assert.equal(messages.length, 1, 'native invitation reaches the declared mailbox')
 const link = new URL(messages[0].text.match(/https:\/\/[^\s]+/)[0])
 assert.equal(link.origin, origin)
 assert.equal(link.pathname, '/auth/confirm')
 const bad = await post('/auth/confirm', { token: crypto.randomUUID() })
 assert.equal(bad.status, 400)
 await bad.body?.cancel()
 const response = await post('/auth/confirm', { token: link.searchParams.get('token') })
 assert.equal(response.status, 303)
 const replay = await post('/auth/confirm', { token: link.searchParams.get('token') })
 assert.equal(replay.status, 400)
 await replay.body?.cancel()
 console.log('Independent reviewer: native invitation 202, confirmation 303, invalid and reused proof 400.')
 return response
}
