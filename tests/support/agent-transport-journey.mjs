import assert from 'node:assert/strict'
import {request as httpRequest} from 'node:http'
import {booking,authorise} from '../harness.mjs'
import {qualityReady} from './quality-ready.mjs'
import {publicDoor} from './portable-repair.mjs'
import {autonomousPolicy,heldPolicy} from '../../src/modules/agent-door/conformance/crypto.mjs'

const version='2026-07-28',tool='mallet.estimates.prepare'
const callMethod=['tools','call'].join('/'),discoverMethod=['server','discover'].join('/')
const envelope=(method,params,id=1)=>({jsonrpc:'2.0',id,method,params:{...params,_meta:{'io.modelcontextprotocol/protocolVersion':version}}})

// Use the actual HTTP listener so a chunked request reaches production without
// Content-Length. JSON whitespace changes byte size without invalidating any
// preparation argument or exceeding its field limits.
function send(h,body,token,{method=callMethod,streamed=false}={}) {
 assert.equal(new URL(h.origin).hostname,'127.0.0.1','Transport fixture only admits the disposable loopback listener')
 const bytes=Buffer.from(body),headers={Origin:h.origin,'Content-Type':'application/json','MCP-Protocol-Version':version,'Mcp-Method':method,
  ...(method===callMethod?{'Mcp-Name':tool}:{}),...(token?{Authorization:'Bearer '+token}:{}),
  ...(streamed?{'Transfer-Encoding':'chunked'}:{'Content-Length':String(bytes.length)})}
 return new Promise((resolve,reject)=>{
  const request=httpRequest(h.origin+'/mcp',{method:'POST',headers,timeout:15000,agent:false},response=>{
   const chunks=[]
   response.on('data',chunk=>chunks.push(chunk))
   response.on('error',reject)
   response.on('end',()=>{
    const text=Buffer.concat(chunks).toString('utf8')
    let message
    try{message=JSON.parse(text)}catch{}
    resolve({status:response.statusCode,message,text})
   })
  })
  request.on('error',reject)
  request.on('timeout',()=>request.destroy(new Error('MCP transport did not respond within 15 seconds')))
  if(streamed)for(let offset=0;offset<bytes.length;offset+=16384)request.write(bytes.subarray(offset,offset+16384))
  request.end(streamed?undefined:bytes)
 })
}

async function retainedBusiness(h) {
 const {job}=await booking(h,{asset:await h.command('asset.create',{customerName:'synthetic-mallet-101',customerEmail:'',label:'synthetic-mallet-102',identifier:'synthetic-mallet-103'})})
 const lines=[{id:'synthetic-mallet-104',kind:'labor',description:'synthetic-mallet-105',quantity:1,unitCents:2500}]
 const quote=await authorise(h,await h.command('estimate.prepare',{jobId:job.id,version:job.version,lines}))
 const current=() => h.state().then(s=>s.records.job.find(row=>row.id===job.id))
 let repair=await current()
 await h.command('dispatch.prepare',{jobId:repair.id,version:repair.version,bayId:repair.bayId,technicianId:repair.technicianId,startAt:repair.startAt,endAt:repair.endAt,reason:'synthetic-mallet-106'})
 repair=await h.command('work.record',{jobId:repair.id,version:repair.version,lineId:quote.revisions[0].lines[0].id,quantity:1})
 // Use the existing key-gated native development entry for the independently
 // invited quality reviewer; local mail is suppressed and no SQL seeds identity.
 const email=['synthetic-mallet-107','example.test'].join('@')
 const reviewer=await publicDoor(h.origin,h.owner).person(email,'admin','synthetic-mallet-107')
 await qualityReady(h,repair,{reviewer})
 repair=await h.command('job.complete',{jobId:repair.id,version:repair.version})
 let invoice=await h.command('invoice.prepare',{jobId:repair.id,version:repair.version})
 invoice=await h.command('invoice.approve',{invoiceId:invoice.id,version:invoice.version,revision:1})
 await h.command('invoice.export',{invoiceId:invoice.id,version:invoice.version})
 const records=(await h.state()).records
 for(const kind of ['job','estimate','proposal','approval','invoice','export','event'])assert.ok(records[kind]?.length>0,'Refusal comparison starts with populated '+kind)
}

export async function agentTransportJourney(h) {
 await h.command('tax.configure',{ratePercent:10,partsTaxable:true,laborTaxable:true})
 await retainedBusiness(h)
 const key=await h.command('agent.create',{label:'synthetic-mallet-108'})
 const discovery=await send(h,JSON.stringify(envelope(discoverMethod,{})),undefined,{method:discoverMethod})
 assert.equal(discovery.status,200)
 const max=discovery.message.result._meta['com.runeditrun/limits'].maxBodyBytes
 assert.ok(Number.isSafeInteger(max)&&max>0,'Use the advertised runtime byte limit')

 for(const [index,document] of [autonomousPolicy(),heldPolicy()].entries()){
  await h.api('/agents/api/policy',{document},{method:'PUT'})
  const {job}=await booking(h,{asset:await h.command('asset.create',{customerName:'synthetic-mallet-109',customerEmail:'',label:'synthetic-mallet-110',identifier:'synthetic-mallet-111-'+index}),
   bayId:'synthetic-mallet-112-'+index,startAt:`2026-12-0${index+1}T12:00:00Z`,endAt:`2026-12-0${index+1}T13:00:00Z`})
  const lines=[{id:'synthetic-mallet-113',kind:'labor',description:'synthetic-mallet-114',quantity:1.5,unitCents:4000}]
  const args={jobId:job.id,version:job.version,lines,notes:'synthetic-mallet-115',idempotency_key:'synthetic-mallet-116-'+index}
  const base=JSON.stringify(envelope(callMethod,{name:tool,arguments:args})),size=Buffer.byteLength(base)
  assert.ok(size<max,'The preparation envelope fits before transport padding')
  const padded=length=>base.slice(0,-1)+' '.repeat(length-size)+'}'
  const oversized=padded(max+1)
  assert.equal(Buffer.byteLength(oversized),max+1)
  assert.deepEqual(JSON.parse(oversized),JSON.parse(base),'Oversize is otherwise the same valid preparation')
  for(const streamed of [false,true]){
   const before=(await h.state()).records,mailCount=h.messages.length
   const response=await send(h,oversized,key.token,{streamed})
   const after=(await h.state()).records
   assert.equal(response.status,413,(streamed?'Chunked overflow':'Content-Length overflow')+' refuses the preparation')
   assert.deepEqual(after,before,'Oversize refusal preserves exact repair versions, estimates, proposals, approvals, invoices, exports and successful business events')
   assert.equal(h.messages.length,mailCount,'Oversize refusal makes no mail handoff')
   console.log('PROBE BASE-AGENT-001 point-6 '+(streamed?'chunked':'content-length')+' policy='+document.rules.at(-1).do+': POST /mcp bytes='+Buffer.byteLength(oversized)+' -> 413; all populated business records unchanged')
  }

  const before=(await h.state()).records,response=await send(h,padded(max),key.token)
  assert.equal(response.status,200)
  assert.equal(response.message.result.isError,false,JSON.stringify(response.message))
  const draft=response.message.result.structuredContent,after=(await h.state()).records
  assert.equal(after.estimate.length,before.estimate.length+1,'One bounded preparation persists exactly one draft')
  assert.deepEqual(after.estimate.filter(row=>row.jobId===job.id),[draft])
  assert.equal(draft.status,'draft');assert.equal(draft.version,1);assert.equal(draft.jobId,job.id);assert.equal(draft.revisions.length,1)
  const revision=draft.revisions[0]
  assert.equal(revision.n,1);assert.equal(revision.notes,'synthetic-mallet-115');assert.equal(revision.approval,null)
  assert.deepEqual(revision.lines.map(({id,kind,description,quantity,quantityMilli,unitCents,subtotalCents,salesTaxCents,totalCents})=>({id,kind,description,quantity,quantityMilli,unitCents,subtotalCents,salesTaxCents,totalCents})),
   [{id:'synthetic-mallet-113',kind:'labor',description:'synthetic-mallet-114',quantity:1.5,quantityMilli:1500,unitCents:4000,subtotalCents:6000,salesTaxCents:600,totalCents:6600}])
  assert.deepEqual(revision.totals,{currency:'USD',subtotalCents:6000,salesTaxCents:600,totalCents:6600})
  assert.equal(revision.preparedBy.role,'agent');assert.equal(revision.preparedBy.attribution.agent.id,'mallet-key:'+key.id)
  assert.deepEqual(after.estimate.filter(row=>row.id!==draft.id),before.estimate,'Retained estimates are unchanged')
  assert.deepEqual(after.job,before.job.map(row=>row.id===job.id?{...row,version:row.version+1,estimateId:draft.id}:row),'Only the prepared repair advances once')
  for(const [kind,rows] of Object.entries(before))if(!['job','estimate','event','audit','stageEvent'].includes(kind))assert.deepEqual(after[kind],rows,'Bounded preparation preserves '+kind)
  assert.deepEqual(after.event.filter(row=>before.event.some(saved=>saved.id===row.id)),before.event)
  const events=after.event.filter(row=>!before.event.some(saved=>saved.id===row.id))
  assert.equal(events.length,1);assert.equal(events[0].kind,'estimate.prepare');assert.equal(events[0].jobId,job.id);assert.equal(events[0].subjectId,draft.id)
  for(const kind of ['stageEvent','audit'])assert.deepEqual(after[kind].filter(row=>before[kind].some(saved=>saved.id===row.id)),before[kind],'Retained '+kind+' history is unchanged')
  const stages=after.stageEvent.filter(row=>!before.stageEvent.some(saved=>saved.id===row.id))
  assert.equal(stages.length,1);assert.equal(stages[0].jobId,job.id);assert.equal(stages[0].stage,'approval');assert.deepEqual(stages[0].commands,['estimate.prepare']);assert.deepEqual(stages[0].eventIds,[events[0].id])
  const audits=after.audit.filter(row=>!before.audit.some(saved=>saved.id===row.id))
  assert.equal(audits.length,1);assert.equal(audits[0].action,'estimate.prepare')
  console.log('PROBE BASE-AGENT-001 point-6 bounded policy='+document.rules.at(-1).do+': POST /mcp bytes='+max+' -> 200; one exact draft, repair version +1 and one successful preparation event')
 }
}
