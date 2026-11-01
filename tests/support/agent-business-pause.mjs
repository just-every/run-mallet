import assert from 'node:assert/strict'
import {randomUUID,webcrypto} from 'node:crypto'
import {autonomousPolicy,policyEnvelope,seconds,signJws} from '../../src/modules/agent-door/conformance/crypto.mjs'

const keyPair=()=>webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify'])

// Business pairs this installation through its public signed doors, as Business would:
// settings bind the original native owner, then company policy (and Pause) arrives signed.
export async function businessPairing(f){
 const {h}=f,kid=randomUUID(),installationId=randomUUID(),business='synthetic-mallet-1260',issuer='https://synthetic-mallet-1261.invalid'
 const pair=await keyPair(),{kty,crv,x,y}=await webcrypto.subtle.exportKey('jwk',pair.publicKey),keys={[kid]:{kty,crv,x,y,kid,alg:'ES256',use:'sig'}}
 const email=(await h.api('/auth/session')).operator.email
 await h.configure({RER_OWNER_CLAIM_ISSUER:issuer,RER_OWNER_CLAIM_INSTALLATION_ID:installationId,RER_OWNER_CLAIM_PUBLIC_KEYS:JSON.stringify(keys),
  RER_BUSINESS_TRUST:JSON.stringify({v:1,issuer,audience:h.origin,subject:installationId,email,keys})})
 const iat=seconds()
 const settings=await signJws(pair.privateKey,kid,'rer-business-settings+jwt',{v:1,iss:issuer,aud:h.origin,sub:installationId,business,email,owner_id:'synthetic-mallet-1262',jti:randomUUID(),iat,exp:iat+300,rev:1,values:{},logo:null,team:null})
 const paired=await h.request('/api/rer/business-settings',{method:'POST',as:'',body:{settings}}),ack=await paired.json()
 assert.equal(paired.status,200,JSON.stringify(ack));assert.equal(ack.rev,1)
 const ctx={signer:{issuer,installationId,kid,privateKey:pair.privateKey},business,origin:h.origin,revision:0,seq:0}
 const adopt=async(options={})=>{
  const envelope=await policyEnvelope(ctx,autonomousPolicy(),options)
  const response=await h.request('/api/rer/agent-policy',{method:'POST',as:'',body:{policy:envelope.policy}}),body=await response.json()
  assert.equal(response.status,200,JSON.stringify(body))
  assert.deepEqual(body.adopted,{seq:envelope.payload.seq,revision:envelope.payload.revision})
  ctx.seq=envelope.payload.seq;ctx.revision=envelope.payload.revision
  return envelope
 }
 const unpaused=await adopt()
 const state=await h.api('/agents/api/state')
 assert.equal(state.paired,true);assert.deepEqual(state.paused,{business:false,local:false})
 assert.equal(state.policy.source,'business');assert.equal(state.policy.business,business);assert.equal(state.policy.complete,true)
 // The same local preparation key now runs under the signed company policy.
 assert.ok((await f.done('mallet.repairs.read',{id:f.prepare.id})).records.job.some(row=>row.id===f.prepare.id))
 return {ctx,adopt,unpaused}
}

export async function businessPause(f,b){
 const pausedAt=performance.now()
 await b.adopt({paused:true})
 assert.deepEqual((await f.h.api('/agents/api/state')).paused,{business:true,local:false})
 return pausedAt
}

// No agent credential can lift Business Pause: it holds no Business signing key, an
// earlier unpaused policy it may have captured is stale, and the local switch is separate.
export async function refusedBusinessResume(f,b){
 const {h,agent}=f,before=(await h.state()).records
 const post=async policy=>{const response=await h.request('/api/rer/agent-policy',{method:'POST',...agent,body:{policy}});return {status:response.status,body:await response.json()}}
 assert.deepEqual(await post(b.unpaused.policy),{status:409,body:{code:'policy_stale'}},'A replayed earlier unpaused policy cannot resume')
 const forged=await policyEnvelope({...b.ctx,signer:{...b.ctx.signer,privateKey:(await keyPair()).privateKey}},autonomousPolicy(),{paused:false,seq:b.ctx.seq+10,revision:b.ctx.revision+10})
 assert.deepEqual(await post(forged.policy),{status:400,body:{code:'policy_invalid'}},'A policy signed by any other key cannot resume')
 const bearer=await h.request('/agents/api/pause',{method:'POST',body:{paused:false},...agent})
 assert.equal(bearer.status,403);assert.deepEqual(await bearer.json(),{code:'person_session_required'})
 // The owner's local switch is independent: switching it never lifts Business Pause.
 const local=await h.request('/agents/api/pause',{method:'POST',body:{paused:false}})
 assert.equal(local.status,200);assert.deepEqual((await local.json()).paused,{business:true,local:false})
 assert.deepEqual((await h.api('/agents/api/state')).paused,{business:true,local:false})
 assert.equal((await f.rpc('mallet.repairs.read',{id:f.prepare.id})).result._meta['com.runeditrun/error'].code,'agents_paused')
 assert.deepEqual((await h.state()).records,before)
 console.log('PROBE BASE-AGENT-011 7 Business: preparation key replays the earlier unpaused signed policy -> 409 policy_stale; forged signature -> 400 policy_invalid; bearer local resume -> 403; owner local switch leaves Business Pause active; repair read still refused')
}

export async function businessResume(f,b){
 const {h}=f,call=f.calls[3],before=(await h.state()).records
 await b.adopt({paused:false})
 assert.deepEqual((await h.api('/agents/api/state')).paused,{business:false,local:false})
 const result=await f.done(call.name,call.args)
 const after=(await h.state()).records,invoice=after.invoice.find(row=>row.id===result.id)
 assert.equal(after.invoice.length,(before.invoice??[]).length+1)
 assert.equal(invoice.jobId,call.args.jobId);assert.equal(invoice.status,'draft')
 assert.deepEqual(invoice.lines.map(({id,kind,quantityMilli,unitCents,totalCents})=>({id,kind,quantityMilli,unitCents,totalCents})),[{id:'synthetic-mallet-1101',kind:'labor',quantityMilli:1250,unitCents:3200,totalCents:4000}])
 assert.equal(invoice.totals.totalCents,4000)
 assert.equal(invoice.preparedBy.attribution.agent.id,'mallet-key:'+f.key.id)
 assert.equal(after.job.find(row=>row.id===call.args.jobId).invoiceId,invoice.id)
 assert.deepEqual(await f.done(call.name,call.args),result,'Business resume preserves exactly one effect on replay')
 assert.deepEqual((await h.state()).records,after)
 assert.equal(after.event.filter(row=>row.kind==='invoice.prepare'&&row.jobId===call.args.jobId).length,1)
 console.log('PROBE BASE-AGENT-011 6 Business resume: newer signed unpaused policy then MCP invoice preparation and retry -> one draft invoice, 1250 thousandths at 3200 cents, 4000 cents and one preparation event')
 return invoice
}
