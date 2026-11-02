// GOV-005: provider secrets are sealed, rotated and revoked by the owner behind a fresh proof, take effect on the next call,
// never appear in any response, record, archive, audit row or log, and a webhook must prove its origin with the current key.
import assert from 'node:assert/strict'
import {createHmac,randomBytes,randomUUID} from 'node:crypto'
import {archive,installation,restore} from '../harness.mjs'
const signed=(key,body,id=randomUUID(),timestamp=String(Math.floor(Date.now()/1000)))=>({'svix-id':id,'svix-timestamp':timestamp,'svix-signature':'v1,'+createHmac('sha256',Buffer.from(key.slice(6),'base64')).update(id+'.'+timestamp+'.'+JSON.stringify(body)).digest('base64')})
const whsec=()=>'whsec_'+randomBytes(32).toString('base64')
export async function connectorJourney() {
 const calls=[],first=whsec(),second=whsec(),third=whsec(),env={PIER:'synthetic-mallet-gov5-pier-env',STRIPE:'synthetic-mallet-gov5-stripe-env'}
 const h=await installation({bindings:{PIER_ORIGIN:'https://pier.example.test',PIER_SESSION:env.PIER,STRIPE_SECRET_KEY:env.STRIPE,MAIL_EVENT_KEY:first},outboundService:async request=>{calls.push({host:new URL(request.url).hostname,cookie:request.headers.get('cookie'),auth:request.headers.get('authorization')});return Response.json({items:[{id:'part-1',sku:'SKU-1',name:'synthetic-mallet-gov5 pads',unit:'pair'}]})}})
 try {
  const db=await h.mf.getD1Database('DB'),member=await h.person('synthetic-mallet-gov5-1@example.test'),admin=await h.person('synthetic-mallet-gov5-2@example.test','admin')
  // Declarations are public before anything is enabled; credentials status is staff-only and never carries a value.
  const published=await h.request('/connectors',{as:''}),html=await published.text();assert.equal(published.status,200)
  for(const shown of ['Stripe','Pier','Email delivery events','Email sending','What Mallet sends','Retention','Licence and access'])assert.ok(html.includes(shown),'GOV-005 publishes '+shown)
  await h.api('/api/mallet/connectors',undefined,{as:'',status:401});await h.api('/api/mallet/connectors',undefined,{as:member.cookie,status:403})
  const catalogue=()=>h.api('/api/mallet/catalogue'),pier=(n=1)=>assert.equal(calls.filter(c=>c.host==='pier.example.test').at(-n).cookie,current)
  let current=env.PIER;await catalogue();pier()
  // Rotate the supplier credential: refused without the owner, the declaration or a sane value; then the next call uses it and the old one is gone.
  const save=(value,options={},extra={})=>h.command('connector.save',{connector:'pier',name:'PIER_SESSION',credential:value,acknowledge:1,...extra},options)
  await save('synthetic-mallet-gov5-pier-2',{as:'',status:401});await save('synthetic-mallet-gov5-pier-2',{as:member.cookie,status:403});await save('synthetic-mallet-gov5-pier-2',{as:admin.cookie,status:403})
  await save('synthetic-mallet-gov5-pier-2',{status:409},{acknowledge:0});await save('short',{status:400});await save('has space inside',{status:400})
  await h.command('connector.save',{connector:'mail',name:'MAIL_API_KEY',credential:'synthetic-mallet-gov5-mail',acknowledge:1},{status:409});await h.command('connector.save',{connector:'nobody',name:'X',credential:'synthetic-mallet-gov5-x',acknowledge:1},{status:404})
  const key=await h.command('agent.create',{label:'synthetic-mallet-gov5 agent'});await save('synthetic-mallet-gov5-pier-2',{as:'',headers:{authorization:'Bearer '+key.token},status:403})
  await h.stepUp();await (await h.mf.getD1Database('DB')).prepare('UPDATE mallet_session_proofs SET step_up_until=0').run()
  const unproven=await h.request('/api/mallet/commands',{method:'POST',body:{command:'connector.save',input:{connector:'pier',name:'PIER_SESSION',credential:'synthetic-mallet-gov5-pier-2',acknowledge:1}}});assert.equal((await unproven.json()).error,'step_up_required');await catalogue();pier()
  const saved=await save('synthetic-mallet-gov5-pier-2');assert.equal(saved.version,1);current='synthetic-mallet-gov5-pier-2';await catalogue();pier()
  const rotated=await save('synthetic-mallet-gov5-pier-3');assert.equal(rotated.version,2);current='synthetic-mallet-gov5-pier-3';await catalogue();pier();assert.ok(!calls.slice(calls.findIndex(c=>c.cookie==='synthetic-mallet-gov5-pier-3')).some(c=>c.cookie===env.PIER||c.cookie==='synthetic-mallet-gov5-pier-2'),'GOV-005 a rotated secret is never used again')
  assert.notEqual(saved.fingerprint,rotated.fingerprint)
  const status=await h.api('/api/mallet/connectors',undefined,{as:admin.cookie});assert.deepEqual(status.secrets.map(s=>[s.connector,s.name,s.status,s.version]),[['pier','PIER_SESSION','active',2]])
  const before=calls.length;await h.command('connector.revoke',{connector:'pier',name:'PIER_SESSION'});const gone=await h.api('/api/mallet/catalogue',undefined,{status:503});assert.equal(gone.error,'PIER_UNAVAILABLE');assert.equal(calls.length,before,'GOV-005 a revoked secret makes no provider call, whatever the deployment binding says')
  // The payment credential: revoking it stops refunds even though the deployment still holds a key; saving a new one resumes.
  const refundAttempt=()=>h.command('refund.submit',{refundId:'synthetic-mallet-gov5',version:1},{status:404}).catch(error=>error)
  assert.equal((await h.request('/api/mallet/commands',{method:'POST',body:{command:'refund.submit',input:{refundId:'x',version:1}}})).status,404)
  await h.command('connector.revoke',{connector:'stripe',name:'STRIPE_SECRET_KEY'});assert.equal((await h.api('/api/mallet/commands',{command:'refund.submit',input:{refundId:'x',version:1}},{status:503})).error,'REFUND_CONFIGURATION')
  await h.command('connector.save',{connector:'stripe',name:'STRIPE_SECRET_KEY',credential:'synthetic-mallet-gov5-stripe-2',acknowledge:(await h.api('/api/mallet/connectors')).declarations.find(c=>c.id==='stripe').version});assert.equal((await h.request('/api/mallet/commands',{method:'POST',body:{command:'refund.submit',input:{refundId:'x',version:1}}})).status,404);void refundAttempt
  // Webhook origin: only the current signing secret opens the door; an old, bad or stale signature opens nothing.
  const endpoint='/api/mallet/inspection-report-events/resend',event={type:'email.delivered',created_at:new Date().toISOString(),data:{email_id:'synthetic-mallet-gov5-msg',to:['synthetic-mallet-gov5@example.test']}}
  const post=(key,options={})=>h.request(endpoint,{method:'POST',as:'',body:event,headers:options.headers??signed(key,event)})
  assert.equal((await post(first)).status,400,'the deployment secret signs until the owner rotates it')
  await h.command('connector.save',{connector:'mail-events',name:'MAIL_EVENT_KEY',credential:second,acknowledge:1})
  assert.equal((await post(first)).status,401,'GOV-005 the replaced signing secret opens nothing');assert.equal((await post(second)).status,400)
  assert.equal((await post(second,{headers:{...signed(second,event),'svix-signature':'v1,'+Buffer.alloc(32).toString('base64')}})).status,401,'GOV-005 a bad signature is refused');assert.equal((await post(second,{headers:signed(second,event,randomUUID(),'1')})).status,401,'GOV-005 a stale timestamp is refused')
  const replayed=signed(second,event);assert.equal((await post(second,{headers:replayed})).status,400);assert.equal((await post(second,{headers:replayed})).status,400,'a replay carries no new authority')
  await h.command('connector.revoke',{connector:'mail-events',name:'MAIL_EVENT_KEY'});assert.equal((await post(second)).status,503,'GOV-005 a revoked signing secret fails closed')
  await h.command('connector.save',{connector:'mail-events',name:'MAIL_EVENT_KEY',credential:third,acknowledge:1});assert.equal((await post(third)).status,400)
  // Agent grants rotate too: the new key replaces the old in one step.
  const agent=await h.command('agent.create',{label:'synthetic-mallet-gov5 prep'}),read=token=>h.request('/api/mallet/state',{as:'',headers:{authorization:'Bearer '+token}})
  assert.equal((await read(agent.token)).status,200);await h.command('agent.rotate',{id:agent.id},{as:member.cookie,status:403})
  const next=await h.command('agent.rotate',{id:agent.id});assert.equal(next.label,agent.label);assert.equal(next.replaced,agent.id);assert.equal((await read(next.token)).status,200);assert.equal((await read(agent.token)).status,401);await h.command('agent.rotate',{id:agent.id},{status:404})
  // Secret absence: every response, record, row, archive and log.
  assert.ok(h.logs.length>0,'the Worker log is captured');const secrets=['synthetic-mallet-gov5-pier-2','synthetic-mallet-gov5-pier-3','synthetic-mallet-gov5-stripe-2',second,third,first,env.PIER,env.STRIPE,agent.token,next.token]
  const tables=(await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'").all()).results.map(t=>t.name),dump=JSON.stringify(Object.fromEntries(await Promise.all(tables.map(async name=>[name,(await db.prepare(`SELECT * FROM ${name}`).all()).results]))))
  const views=JSON.stringify([await (await h.request('/api/mallet/state')).json(),await (await h.request('/api/mallet/connectors')).json(),await (await h.request('/app/connectors')).text(),await (await h.request('/app/data')).text(),await (await h.request('/app/security')).text(),JSON.stringify(await archive(h)),h.logs.join('\n')])
  for(const secret of secrets){assert.ok(!dump.includes(secret),'GOV-005 database rows hold no clear credential value '+secret.slice(0,24));assert.ok(!views.includes(secret),'GOV-005 responses, archive and logs hold no credential value '+secret.slice(0,24))}
  const audit=(await db.prepare("SELECT action FROM oa_auth_audit WHERE action LIKE 'mallet:connector%' OR action='mallet:agent.rotated' ORDER BY created_at").all()).results.map(r=>r.action);for(const action of ['mallet:connector.secret.saved','mallet:connector.secret.rotated','mallet:connector.secret.revoked','mallet:agent.rotated'])assert.ok(audit.includes(action),'GOV-005 audit records '+action)
  // A restored installation starts with no saved secrets: credentials are never portable.
  const target=await installation();try{await restore(target,await archive(h));assert.deepEqual((await target.api('/api/mallet/connectors')).secrets,[])}finally{await target.close()}
 } finally { await h.close() }
}
