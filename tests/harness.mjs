import {Miniflare,Log,LogLevel,convertV4MiniflareOptions} from 'miniflare'
import {unstable_splitSqlQuery} from 'wrangler'
import {workerBundle} from './support/worker-bundle.mjs'
import {createHmac,randomBytes,randomUUID} from 'node:crypto'
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {totpCode} from './support/second-factor.mjs'
import {localHttps} from './support/local-https.mjs'
const bundles={}
// entry: the Worker under test; bindings: extra Worker bindings (the demo test sets RER_DEMO).
export async function installation({entry='tests/worker.ts',bindings={},outboundService,mailService,network=false,assets=false,secureNetwork=false,localhost=false,onScratch,clock}={}) {
 let bundle=bundles[entry+String(clock??'')]??=await workerBundle(entry,clock)
 const directory=await mkdtemp(join(tmpdir(),'mallet-api-')),setup=randomBytes(32).toString('hex'),messages=[]
 let origin='https://127.0.0.1'
 // Everything the Worker logs, kept for tests that prove a secret never reaches a log.
 onScratch?.(directory)
 const logs=[];class Capture extends Log{log(message){logs.push(String(message));if(!String(message).startsWith('[mf:'))super.log(message)}}
 const secret=randomBytes(32).toString('hex'),randomVaultKey=randomBytes(32).toString('hex')
 const options=()=>({...convertV4MiniflareOptions({host:'127.0.0.1',...(secureNetwork?{https:true}:{}),port:Number(new URL(origin).port),modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-09-08',compatibilityFlags:['nodejs_compat'],...(assets?{assets:{directory:'public',binding:'ASSETS',run_worker_first:true,routerConfig:{has_user_worker:true}}}:{}),d1Databases:['DB'],r2Buckets:['INTAKE_VAULT'],bindings:{AUTH_ORIGIN:origin,OWNER_EMAIL:'owner@example.test',SESSION_SECRET:secret,INTAKE_VAULT_KEY:randomVaultKey,SETUP_TOKEN:setup,MAIL_PROVIDER:'resend',MAIL_API_KEY:'test-mail-edge',MAIL_FROM:'auth@example.test',...bindings},log:new Capture(LogLevel.INFO),handleStructuredLogs:({message})=>logs.push(String(message)),outboundService:async request=>{if(outboundService&&new URL(request.url).hostname!=='api.resend.com')return outboundService(request);assert.equal(new URL(request.url).hostname,'api.resend.com');const message=await request.json();messages.push(message);return mailService?mailService(message):Response.json({id:randomUUID()})}}),resourcePersistencePath:directory})
 let mf=new Miniflare(options())
 try {
  origin=(network&&!secureNetwork?'http://':'https://')+(localhost?'localhost:'+(await mf.ready).port:(await mf.ready).host)
  await mf.setOptions(options())
  await mf.ready
 }catch(error){await mf.dispose();await rm(directory,{recursive:true,force:true});throw error}
 try {
  const db=await mf.getD1Database('DB')
  for(const file of (await readdir('migrations/core')).filter(f=>f.endsWith('.sql')).sort())await db.batch(unstable_splitSqlQuery(await readFile(join('migrations/core',file),'utf8')).map(sql=>db.prepare(sql)))
  let owner=''
  const request=(path,{method='GET',body,as=owner,headers={}}={})=>(network&&secureNetwork&&localhost?localHttps:network&&!secureNetwork?fetch:mf.dispatchFetch.bind(mf))(origin+path,{method,redirect:'manual',headers:{origin,host:new URL(origin).host,'content-type':'application/json',...(as?{cookie:as}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})})
  const boot=await request('/auth/bootstrap',{method:'POST',body:{token:setup,displayName:'Morgan Workshop'}});assert.equal(boot.status,303,await boot.text())
  owner=boot.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')
  if(bindings.RER_DEV_KEY){const gate=await request('/__dev/key',{method:'POST',body:{key:bindings.RER_DEV_KEY}});assert.equal(gate.status,204);owner+='; '+gate.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')}
  // A further sign-in for an existing person, as a confirmed email link would open it, for browsers that run with mail suppressed.
  const signInAs=async email=>{
   const db=await mf.getD1Database('DB'),token=randomBytes(32).toString('base64url'),person=await db.prepare('SELECT id,version FROM oa_operators WHERE email=?').bind(email).first(),now=clock?Date.parse(clock):Date.now(),name=owner.split('; ').map(x=>x.split('=')[0]).find(x=>/operator_session/.test(x))
   await db.prepare("INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES(?,?,?,?,'native',?,?)").bind(randomUUID(),createHmac('sha256',secret).update('session\0'+token).digest('hex'),person.id,person.version,now,now+3600000).run()
   return name+'='+token
  }
  // A second factor held by each cookie that asked for one, and the fresh proof a privileged command needs (GOV-004).
  const secrets=new Map()
  const stepUp=async(as=owner)=>{
   const known=secrets.get(as)
   if(!known){
    const begun=await (await request('/api/mallet/security/totp/begin',{method:'POST',as,body:{}})).json(),confirmed=await request('/api/mallet/security/totp/confirm',{method:'POST',as,body:{code:totpCode(begun.secret,clock?Date.parse(clock):undefined)}}),value=await confirmed.json()
    assert.equal(confirmed.status,200,JSON.stringify(value));secrets.set(as,begun.secret);return {secret:begun.secret,recoveryCodes:value.recoveryCodes}
   }
   // The same authenticator again: a code is single-use per thirty-second step, so clear the replay fence the clock would.
   await (await mf.getD1Database('DB')).prepare('UPDATE mallet_factors SET last_step=NULL WHERE kind=?').bind('totp').run()
   const verified=await request('/api/mallet/security/verify/totp',{method:'POST',as,body:{code:totpCode(known,clock?Date.parse(clock):undefined)}});assert.equal(verified.status,200,await verified.text());return {secret:known}
  }
  // A privileged command asks for a fresh proof; the shared harness gives it unless a test is asserting the refusal.
  const api=async(path,body,{status=200,...options}={})=>{const response=await request(path,{...(body===undefined?{}:{method:'POST',body}),...options});const value=await response.json();if(response.status===403&&value.error==='step_up_required'&&status!==403&&!options.refuseStepUp){await stepUp(options.as??owner);return api(path,body,{status,...options,refuseStepUp:true})}assert.equal(response.status,status,JSON.stringify(value));return value}
  const command=(command,input={},options={})=>api('/api/mallet/commands',{command,input},options)
  const state=(options={})=>api('/api/mallet/state',undefined,options)
  const person=async(email,role='member')=>{
   await api('/auth/invite',{email,role,displayName:email.split('@')[0],returnTo:'/app'},{status:202})
   const message=messages.findLast(m=>JSON.stringify(m.to).includes(email));assert.ok(message,'Invitation reached mail edge')
   const match=message.text.match(/https?:\/\/[^\s<>]+\/auth\/confirm\?token=[^\s<>]+/);assert.ok(match)
   const token=new URL(match[0]).searchParams.get('token'),confirmed=await request('/auth/confirm',{method:'POST',as:'',body:{token}});assert.equal(confirmed.status,303)
   const cookie=confirmed.headers.getSetCookie().map(x=>x.split(';')[0]).join('; '),session=await api('/auth/session',undefined,{as:cookie})
   return {cookie,id:session.operator.id,session}
  }
  // The Worker's cron door at a chosen scheduled time (EST-006 reminders).
  const cron=async at=>{const result=await (await mf.getWorker()).scheduled({scheduledTime:new Date(at),cron:'*/15 * * * *'});assert.equal(result.outcome,'ok')}
  return {get mf(){return mf},origin,owner,messages,logs,request,api,command,state,person,cron,stepUp,signInAs,async advanceClock(at){assert.ok(clock&&Number.isFinite(Date.parse(at))&&Date.parse(at)>=Date.parse(clock),'Advance a pinned test clock monotonically');clock=at;bundle=await workerBundle(entry,clock);await mf.setOptions(options());await mf.ready},async restart(){await mf.dispose();mf=new Miniflare(options());await mf.ready},async configure(values){Object.assign(bindings,values);await mf.setOptions(options());await mf.ready},async close(){await mf.dispose();await rm(directory,{recursive:true,force:true})}}
 }catch(error){await mf.dispose();await rm(directory,{recursive:true,force:true});throw error}
}
export async function run(fn,options){const h=await installation(options);try{return await fn(h)}finally{await h.close()}}
export const assetInput=(suffix='1')=>({customerName:'Cedar Bikes',customerEmail:'cedar@example.test',label:'Trek FX 3',identifier:'BIKE-'+suffix})
export async function booking(h,{asset,technicianId,startAt='2026-10-19T09:00:00+10:00',endAt='2026-10-19T10:00:00+10:00',bayId='Bay 1'}={}) {
 technicianId??=(await h.state()).actor.id
 asset??=await h.command('asset.create',assetInput())
 return {asset,job:await h.command('job.book',{assetId:asset.id,version:asset.version,title:'Brake service',technicianId,bayId,startAt,endAt})}
}
export async function estimate(h,job,options={}) {
 if((await h.state()).records.taxSettings?.[0]?.ratePercent==null)await h.command('tax.configure',{ratePercent:10,partsTaxable:true,laborTaxable:true})
 return h.command('estimate.prepare',{jobId:job.id,version:job.version,lines:[{kind:'part',description:'Brake pads',quantity:2,unitCents:2500},{kind:'labor',description:'Replace and tune',quantity:1.5,unitCents:12000}]},options)
}
export async function authorise(h,q,lineIds=q.revisions[0].lines.map(l=>l.id)) {
 q=await h.command('estimate.approve',{estimateId:q.id,version:q.version,revision:1})
 q=await h.command('estimate.markSent',{estimateId:q.id,version:q.version,revision:1,method:'printed'})
 const s=await h.state(),job=s.records.job.find(j=>j.id===q.jobId),asset=s.records.asset.find(a=>a.id===job.assetId),account=s.records.customerAccount?.find(a=>a.id===asset.customerAccountId)
 const fleet=account?.kind==='fleet'?{authorizerId:account.authorizerId,accountVersion:account.version,po:'synthetic-mallet-fleet-po',fleetEvidence:'Owner reviewed exact fleet manager instruction for this revision'}:{}
 return h.command('estimate.authorise',{...fleet,estimateId:q.id,version:q.version,revision:1,lineIds,customerName:'Cedar Bikes',method:'signed',evidence:'Signed paper estimate in workshop custody, reference CB-20'})
}
export async function archive(h) {
 const {id}=await h.api('/api/portability/exports',{},{status:201})
 let state;do{state=await h.api(`/api/portability/exports/${id}/advance`,{})}while(state.phase!=='complete')
 const response=await h.request(`/api/portability/exports/${id}/download`);assert.equal(response.status,200)
 return (await response.text()).trim().split('\n').map(x=>JSON.parse(x))
}
export async function restore(h,lines,{status=200,laterJournal}={}) {
 const {id}=await h.api('/api/portability/imports',{manifest:lines[0],confirmed:true},{status:201})
 for(const part of lines.filter(x=>x.kind==='part'))await h.api(`/api/portability/imports/${id}/parts/${part.index}`,part,{method:'PUT'})
 return h.api(`/api/portability/imports/${id}/finalize`,{archiveHash:lines.at(-1).archiveHash,contentHash:lines.at(-1).contentHash,...(laterJournal?{laterJournal}:{})},{status})
}
export async function snapshots(){return {customers:JSON.parse(await readFile('tests/fixtures/repairshopr/customers.json','utf8')),assets:JSON.parse(await readFile('tests/fixtures/repairshopr/assets.json','utf8'))}}
