// GOV-004: second factors (authenticator app, passkey, recovery codes), the owner's policy, deployment recovery and refund-grade step-up.
import assert from 'node:assert/strict'
import {createHash,randomBytes} from 'node:crypto'
import {archive} from '../harness.mjs'
import {passkeyDevice,totpCode} from './second-factor.mjs'
import {shopSetup} from './diagnosis-journey.mjs'
const SECURITY='/api/mallet/security/'
export const posted=(h,path,body={},as=h.owner)=>h.request(SECURITY+path,{method:'POST',as,body})
export async function signIn(h,email){
 await (await h.mf.getD1Database('DB')).prepare('DELETE FROM oa_limits').run() // Base paces sign-in mail per address; each journey step here is a different sitting.
 const before=h.messages.length
 assert.equal((await h.request('/auth/magic-link',{method:'POST',as:'',body:{email}})).status,202)
 const message=h.messages.slice(before).findLast(m=>JSON.stringify(m.to).includes(email)),token=new URL(message.text.match(/https?:\/\/[^\s<>]+\/auth\/confirm\?token=[^\s<>]+/)[0]).searchParams.get('token')
 const confirmed=await h.request('/auth/confirm',{method:'POST',as:'',body:{token}});assert.equal(confirmed.status,303)
 return confirmed.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')
}
const refusal=async(response,status,code)=>{const value=await response.json();assert.equal(response.status,status,JSON.stringify(value));assert.equal(value.error,code);return value}
export async function secondFactorJourney(h) {
 await shopSetup(h)
 const db=await h.mf.getD1Database('DB'),email=(await h.api('/auth/session')).operator.email,stolen=await signIn(h,email)
 await h.state({as:stolen})
 // Enrol an authenticator app: a wrong code enrols nothing; the seed and recovery codes are shown once and stored sealed.
 const begun=await (await posted(h,'totp/begin')).json(),at=Date.now()
 assert.match(begun.uri,/^otpauth:\/\/totp\//);assert.equal((await h.api(SECURITY.slice(0,-1))).factors.length,0)
 await refusal(await posted(h,'totp/confirm',{code:totpCode(begun.secret,at,5)}),403,'invalid_code');assert.equal((await h.api(SECURITY.slice(0,-1))).factors.length,0)
 const enrolled=await (await posted(h,'totp/confirm',{code:totpCode(begun.secret,at),label:'Phone'})).json()
 assert.equal(enrolled.recoveryCodes.length,8)
 const status=await h.api(SECURITY.slice(0,-1)),rows=JSON.stringify([(await db.prepare('SELECT * FROM mallet_factors').all()).results,(await db.prepare('SELECT * FROM mallet_recovery_codes').all()).results,(await db.prepare('SELECT * FROM mallet_totp_pending').all()).results])
 assert.deepEqual(status.factors.map(f=>[f.kind,f.label]),[['totp','Phone']]);assert.ok(status.session.proven)
 for(const secret of [begun.secret,...enrolled.recoveryCodes,...enrolled.recoveryCodes.map(c=>c.replace('-',''))])assert.ok(!JSON.stringify(status).includes(secret)&&!rows.includes(secret),'GOV-004 seeds and recovery codes are never stored or returned in the clear')
 await h.state({as:stolen,status:401}) // the first factor ends every other session of this person
 // A fresh sign-in owes the factor; nothing of the shop, nor Base's account routes, opens before it.
 const fresh=await signIn(h,email)
 for(const path of ['/api/mallet/state','/api/mallet/catalogue','/api/portability/exports','/auth/operators','/auth/sessions'])assert.equal((await h.request(path,{as:fresh})).status,403,'GOV-004 '+path+' refuses an unproven session')
 const redirected=await h.request('/app/jobs',{as:fresh,headers:{accept:'text/html'}});assert.equal(redirected.status,303);assert.match(redirected.headers.get('location'),/^\/app\/security\?returnTo=/)
 await refusal(await h.request('/api/mallet/commands',{method:'POST',as:fresh,body:{command:'asset.create',input:{customerName:'x',customerEmail:'x@example.test',label:'x',identifier:'x'}}}),403,'second_factor_required');assert.equal((await h.state()).records.asset?.length??0,0)
 await refusal(await posted(h,'verify/totp',{code:totpCode(begun.secret,at)},fresh),403,'invalid_code') // replay of the enrolment code
 assert.ok(!(await h.api(SECURITY.slice(0,-1),undefined,{as:fresh})).session.proven)
 assert.equal((await posted(h,'verify/totp',{code:totpCode(begun.secret,at,1)},fresh)).status,200);await h.state({as:fresh})
 // Guessing is paused: eight misses, then even the right code waits out the window and opens nothing.
 const guesser=await signIn(h,email)
 for(let n=0;n<8;n++)await refusal(await posted(h,'verify/totp',{code:totpCode(begun.secret,at,9)},guesser),403,'invalid_code')
 await refusal(await posted(h,'verify/totp',{code:totpCode(begun.secret,Date.now())},guesser),429,'too_many_attempts');await h.state({as:guesser,status:403})
 await db.prepare('DELETE FROM mallet_rate').run();await db.prepare('UPDATE mallet_factors SET last_step=NULL').run()
 // A passkey: the browser's key pair never leaves the device; the server checks origin, relying party, user verification, challenge and counter.
 const device=passkeyDevice({origin:h.origin}),options=async(path,as=fresh)=>await (await posted(h,path,{},as)).json()
 let o=await options('passkey/register-options');await refusal(await posted(h,'passkey/register',{challengeId:o.challengeId,...device.create(o.publicKey,{at:'https://evil.test'})},fresh),403,'invalid_passkey')
 o=await options('passkey/register-options');await refusal(await posted(h,'passkey/register',{challengeId:o.challengeId,...passkeyDevice({origin:h.origin,verified:false}).create(o.publicKey)},fresh),403,'invalid_passkey')
 o=await options('passkey/register-options');await refusal(await posted(h,'passkey/register',{challengeId:o.challengeId,...passkeyDevice({origin:h.origin,rpId:'other.test'}).create(o.publicKey)},fresh),403,'invalid_passkey')
 o=await options('passkey/register-options');const registered=await posted(h,'passkey/register',{challengeId:o.challengeId,label:'Laptop',...device.create(o.publicKey)},fresh);assert.equal(registered.status,200);assert.equal((await registered.json()).recoveryCodes,undefined)
 await refusal(await posted(h,'passkey/register',{challengeId:o.challengeId,...device.create(o.publicKey)},fresh),400,'challenge_expired')
 const passkeyOnly=await signIn(h,email);await h.state({as:passkeyOnly,status:403})
 let a=await options('verify/passkey-options',passkeyOnly),assertion=device.get(a.publicKey)
 await refusal(await posted(h,'verify/passkey',{challengeId:a.challengeId,...device.get(a.publicKey,{at:'https://evil.test'})},passkeyOnly),403,'invalid_passkey')
 a=await options('verify/passkey-options',passkeyOnly);assertion=device.get(a.publicKey)
 await refusal(await posted(h,'verify/passkey',{challengeId:a.challengeId,...assertion},await signIn(h,email)),400,'challenge_expired') // another session cannot spend this challenge
 assert.equal((await posted(h,'verify/passkey',{challengeId:a.challengeId,...assertion},passkeyOnly)).status,200);await h.state({as:passkeyOnly})
 await refusal(await posted(h,'verify/passkey',{challengeId:a.challengeId,...assertion},passkeyOnly),400,'challenge_expired')
 a=await options('verify/passkey-options',passkeyOnly);await refusal(await posted(h,'verify/passkey',{challengeId:a.challengeId,...device.get(a.publicKey,{count:device.counter})},passkeyOnly),403,'invalid_passkey') // a cloned authenticator repeats its counter
 // A recovery code opens one sign-in once, and is not a fresh privileged proof.
 const lost=await signIn(h,email),code=enrolled.recoveryCodes[0]
 await refusal(await posted(h,'verify/recovery',{code:'AAAAA-AAAAA'},lost),403,'invalid_code')
 const used=await (await posted(h,'verify/recovery',{code:code.toLowerCase()},lost)).json();assert.equal(used.recoveryRemaining,7);await h.state({as:lost})
 await refusal(await posted(h,'verify/recovery',{code},await signIn(h,email)),403,'invalid_code')
 await refusal(await posted(h,'factors/remove',{id:status.factors[0].id},lost),403,'step_up_required')
 // Removing a factor needs a fresh proof; an expired proof refuses until confirmed again.
 await db.prepare('UPDATE mallet_session_proofs SET step_up_until=0').run()
 await refusal(await posted(h,'factors/remove',{id:status.factors[0].id},passkeyOnly),403,'step_up_required')
 a=await options('verify/passkey-options',passkeyOnly);assert.equal((await posted(h,'verify/passkey',{challengeId:a.challengeId,...device.get(a.publicKey)},passkeyOnly)).status,200)
 assert.equal((await posted(h,'factors/remove',{id:(await h.api(SECURITY.slice(0,-1),undefined,{as:passkeyOnly})).factors.find(f=>f.kind==='totp').id},passkeyOnly)).status,200)
 await refusal(await posted(h,'verify/totp',{code:totpCode(begun.secret,Date.now(),1)},await signIn(h,email)),403,'invalid_code') // a removed authenticator verifies nothing
 // Recorded without secrets, and never archived.
 const audit=(await db.prepare("SELECT action,value FROM oa_auth_audit WHERE action LIKE 'mallet:%'").all()).results,all=JSON.stringify(audit)
 for(const action of ['mallet:factor.enrolled','mallet:recovery.used','mallet:factor.removed'])assert.ok(audit.some(r=>r.action===action),'GOV-004 audit records '+action)
 for(const secret of [begun.secret,code,device.credentialId])assert.ok(!all.includes(secret),'GOV-004 audit never holds a secret')
 const exported=JSON.stringify(await archive(h));for(const secret of [begun.secret,code,device.credentialId,'secret_box'])assert.ok(!exported.includes(secret),'GOV-004 archives carry no second-factor material: '+secret)
}
export async function policyRecoveryJourney(h) {
 const db=await h.mf.getD1Database('DB'),owner=await h.api('/auth/session'),email=owner.operator.email,member=await h.person('synthetic-mallet-gov4-1@example.test'),ownerSecond=await signIn(h,email)
 await refusal(await posted(h,'policy',{requireAll:true}),409,'owner_factor_required') // an owner without a factor cannot lock everyone out
 const {secret,recoveryCodes}=await h.stepUp();await h.state({as:ownerSecond,status:401})
 await refusal(await posted(h,'policy',{requireAll:true},member.cookie),403,'owner_required')
 await db.prepare('UPDATE mallet_session_proofs SET step_up_until=0').run();await refusal(await posted(h,'policy',{requireAll:true}),403,'step_up_required')
 await h.stepUp();assert.deepEqual(await (await posted(h,'policy',{requireAll:true})).json(),{requireAll:true,version:1})
 // Owner-required policy: the member's open session and a fresh one owe a factor and can do nothing but set one up.
 await refusal(await h.request('/api/mallet/state',{as:member.cookie}),403,'second_factor_required')
 const inviteHeld=await h.request('/auth/invite',{method:'POST',as:member.cookie,body:{email:'synthetic-mallet-gov4-2@example.test',role:'member'}});assert.equal(inviteHeld.status,403,'GOV-004 Base account routes also wait for the factor')
 const mine=await (await posted(h,'totp/begin',{},member.cookie)).json();assert.equal((await posted(h,'totp/confirm',{code:totpCode(mine.secret)},member.cookie)).status,200);await h.state({as:member.cookie})
 await refusal(await posted(h,'factors/remove',{id:(await h.api(SECURITY.slice(0,-1),undefined,{as:member.cookie})).factors[0].id},member.cookie),409,'last_factor')
 // Lost device: the owner resets that person; their sessions end and old codes verify nothing.
 await refusal(await posted(h,'operators/reset',{operatorId:owner.operator.id},member.cookie),403,'owner_required')
 assert.equal((await posted(h,'operators/reset',{operatorId:member.id})).status,200);await h.state({as:member.cookie,status:401})
 const again=await signIn(h,'synthetic-mallet-gov4-1@example.test');await refusal(await posted(h,'verify/totp',{code:totpCode(mine.secret,Date.now(),1)},again),409,'no_factor');await h.state({as:again,status:403})
 // Session recovery by mail does not reveal who exists and is paced per address.
 const unknown=await h.request('/auth/magic-link',{method:'POST',as:'',body:{email:'nobody-gov4@example.test'}}),known=await h.request('/auth/magic-link',{method:'POST',as:'',body:{email}});assert.deepEqual([unknown.status,await unknown.json()],[known.status,await known.json()])
 let paced=0;for(;paced<30&&(await h.request('/auth/magic-link',{method:'POST',as:'',body:{email}})).status===202;paced++);assert.ok(paced<30,'GOV-004 repeated recovery mail requests are rate limited')
 // Owner recovery by deployment credentials: the one-time `rer signin` link opens only the security door, and starting over ends every other session.
 const token=randomBytes(32).toString('base64url'),hash=createHash('sha256').update('owner-signin\0'+token).digest('hex'),now=Date.now()
 await db.prepare('INSERT INTO oa_owner_signins(id,token_hash,operator_id,operator_version,created_at,expires_at) VALUES(?,?,?,?,?,?)').bind('grant-gov4',hash,owner.operator.id,owner.operator.version??1,now,now+600000).run()
 const keep=await signIn(h,email),granted=await h.request('/auth/owner-signin',{method:'POST',as:'',body:{token}});assert.equal(granted.status,303,await granted.text())
 const recovery=granted.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')
 await refusal(await h.request('/api/mallet/state',{as:recovery}),403,'second_factor_required');assert.ok((await h.api(SECURITY.slice(0,-1),undefined,{as:recovery})).session.deploymentRecovery)
 await refusal(await posted(h,'reset',{},keep),403,'recovery_required');await refusal(await posted(h,'reset',{},member.cookie),401,'sign_in_required')
 assert.equal((await posted(h,'reset',{},recovery)).status,200);await h.state({as:h.owner,status:401});await h.state({as:keep,status:401})
 assert.deepEqual((await h.api(SECURITY.slice(0,-1),undefined,{as:recovery})).factors,[]);await refusal(await h.request('/api/mallet/state',{as:recovery}),403,'second_factor_required') // policy still requires a new factor
 await refusal(await posted(h,'verify/recovery',{code:recoveryCodes[1]},recovery),409,'no_factor')
 const next=await (await posted(h,'totp/begin',{},recovery)).json(),renewed=await (await posted(h,'totp/confirm',{code:totpCode(next.secret)},recovery)).json();assert.equal(renewed.recoveryCodes.length,8);await h.state({as:recovery})
 assert.equal((await posted(h,'reset',{},recovery)).status,200,'the grant session may reset again');assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM oa_auth_audit WHERE action='mallet:factors.reset'").first()).n,3)
 void secret
}
export async function stepUpJourney(h) {
 await shopSetup(h)
 const db=await h.mf.getD1Database('DB'),owner=await h.stepUp(),expire=()=>db.prepare('UPDATE mallet_session_proofs SET step_up_until=0').run()
 const commands=['credit.issue','credit.apply','credit.exchange','refund.record','refund.redirect','refund.submit','refund.reconcile','agent.create','asset.erase','intake.secretReveal','return.override']
 const send=(command,input={},options={})=>h.request('/api/mallet/commands',{method:'POST',body:{command,input},...options})
 await expire();const before=JSON.stringify((await h.state()).records),keys=()=>db.prepare('SELECT COUNT(*) AS n FROM mallet_agent_keys').first()
 for(const command of commands){const response=await send(command,{label:'synthetic-mallet-key',assetId:'x',confirm:'ERASE'}),value=await response.json();assert.equal(response.status,403,command);assert.deepEqual(Object.keys(value).sort(),['error','message'],'GOV-004 a refusal carries no shop data');assert.equal(value.error,'step_up_required',command)}
 assert.equal(JSON.stringify((await h.state()).records),before,'GOV-004 refused privileged commands write nothing');assert.equal((await keys()).n,0)
 // A person at a form is taken to confirm and returned to the page they were on.
 const form=await h.mf.dispatchFetch(h.origin+'/app/actions',{method:'POST',redirect:'manual',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({command:'agent.create',label:'synthetic-mallet-key'}).toString()});assert.equal(form.status,303);assert.equal(form.headers.get('location'),'/app/security?stepUp=1&returnTo=%2Fapp%2Fdata')
 // Preview is read-only and not gated; an agent key can never hold the proof.
 assert.notEqual((await (await send('credit.preview',{})).json()).error,'step_up_required')
 const agent=await h.stepUp().then(()=>h.command('agent.create',{label:'synthetic-mallet-key'}));assert.equal((await keys()).n,1)
 for(const command of commands.filter(c=>c!=='agent.create'))assert.notEqual((await (await send(command,{})).json()).error,'step_up_required','GOV-004 a fresh proof lifts the gate for '+command)
 await expire()
 const member=await h.person('synthetic-mallet-gov4-3@example.test'),bearer={as:'',headers:{authorization:'Bearer '+agent.token}};for(const command of commands)assert.equal((await (await send(command,{},{as:member.cookie})).json()).error==='step_up_required',false,'GOV-004 a member meets the command’s own refusal, not a confirmation prompt');for(const command of commands)assert.equal((await send(command,{},bearer)).status,403,'GOV-004 an agent key cannot refund, erase, reveal or mint keys: '+command)
 void owner
}
