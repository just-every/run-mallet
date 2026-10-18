import {Miniflare,convertV4MiniflareOptions} from 'miniflare'
import {unstable_splitSqlQuery} from 'wrangler'
import {build} from 'esbuild'
import {randomBytes,randomUUID} from 'node:crypto'
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import assert from 'node:assert/strict'
const bundles={}
// entry: the Worker under test; bindings: extra Worker bindings (the demo test sets RER_DEMO).
export async function installation({entry='tests/worker.ts',bindings={}}={}) {
 const bundle=bundles[entry]??=await build({entryPoints:[entry],bundle:true,write:false,format:'esm',platform:'neutral',target:'es2022',external:['node:*','cloudflare:*']})
 const directory=await mkdtemp(join(tmpdir(),'mallet-api-')),setup=randomBytes(32).toString('hex'),messages=[]
 let origin='https://127.0.0.1'
 const secret=randomBytes(32).toString('hex')
 const options=()=>({...convertV4MiniflareOptions({host:'127.0.0.1',port:Number(new URL(origin).port),modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-09-08',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{AUTH_ORIGIN:origin,OWNER_EMAIL:'owner@example.test',SESSION_SECRET:secret,SETUP_TOKEN:setup,MAIL_PROVIDER:'resend',MAIL_API_KEY:'test-mail-edge',MAIL_FROM:'auth@example.test',...bindings},outboundService:async request=>{assert.equal(new URL(request.url).hostname,'api.resend.com');messages.push(await request.json());return Response.json({id:randomUUID()})}}),resourcePersistencePath:directory})
 const mf=new Miniflare(options())
 try {
  origin='https://'+(await mf.ready).host
  await mf.setOptions(options())
  await mf.ready
 }catch(error){await mf.dispose();await rm(directory,{recursive:true,force:true});throw error}
 try {
  const db=await mf.getD1Database('DB')
  for(const file of (await readdir('migrations/core')).filter(f=>f.endsWith('.sql')).sort())await db.batch(unstable_splitSqlQuery(await readFile(join('migrations/core',file),'utf8')).map(sql=>db.prepare(sql)))
  let owner=''
  const request=(path,{method='GET',body,as=owner,headers={}}={})=>mf.dispatchFetch(origin+path,{method,redirect:'manual',headers:{origin,host:new URL(origin).host,'content-type':'application/json',...(as?{cookie:as}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})})
  const boot=await request('/auth/bootstrap',{method:'POST',body:{token:setup,displayName:'Morgan Workshop'}});assert.equal(boot.status,303,await boot.text())
  owner=boot.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')
  const api=async(path,body,{status=200,...options}={})=>{const response=await request(path,{...(body===undefined?{}:{method:'POST',body}),...options});const value=await response.json();assert.equal(response.status,status,JSON.stringify(value));return value}
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
  return {mf,origin,owner,messages,request,api,command,state,person,async close(){await mf.dispose();await rm(directory,{recursive:true,force:true})}}
 }catch(error){await mf.dispose();await rm(directory,{recursive:true,force:true});throw error}
}
export async function run(fn,options){const h=await installation(options);try{return await fn(h)}finally{await h.close()}}
export const assetInput=(suffix='1')=>({customerName:'Cedar Bikes',customerEmail:'cedar@example.test',label:'Trek FX 3',identifier:'BIKE-'+suffix})
export async function booking(h,{asset,technicianId='Alex',startAt='2026-10-19T09:00:00+10:00',endAt='2026-10-19T10:00:00+10:00',bayId='Bay 1'}={}) {
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
 return h.command('estimate.authorise',{estimateId:q.id,version:q.version,revision:1,lineIds,customerName:'Cedar Bikes',method:'signed',evidence:'Signed paper estimate in workshop custody, reference CB-20'})
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
