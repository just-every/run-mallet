import assert from 'node:assert/strict'
import {booking,authorise} from '../harness.mjs'

const rule='synthetic-mallet-987-standard'
export const standardPolicy=disposition=>({schema:'rer-agent-policy/1',catalogue:'rer-agent-classes/1',rules:[{id:rule,class:'standard',do:disposition}],spend:{none:true}})
const decisionKey='com.runeditrun/decision',errorKey='com.runeditrun/error'

// Two transports prepare different native repairs. Expected prices and quantities
// are specified independently of the returned draft and policy implementation.
export async function agentStandardPolicyJourney(h,{adopt,observe=async()=>{},outbound=()=>[]}={}){
 const policy=()=>h.api('/agents/api/policy')
 adopt??=async document=>h.api('/agents/api/policy',{document},{method:'PUT'})
 const setup=await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',redirect:'manual',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes&ratePercent=10&partsTaxable=yes&laborTaxable=yes'})
 assert.equal(setup.status,303)
 const owner=(await h.state()).actor
 let day=10
 const repair=async suffix=>{
  const asset=await h.command('asset.create',{customerName:'synthetic-mallet-'+suffix,customerEmail:'',label:'Repair bicycle '+suffix,identifier:'synthetic-mallet-'+suffix})
  const date='2026-11-'+day++
  return (await booking(h,{asset,bayId:'synthetic-mallet-'+suffix,technicianId:owner.id,startAt:date+'T09:00:00Z',endAt:date+'T10:00:00Z'})).job
 }
 const retained=await repair('987-retained')
 const authorized=await authorise(h,await h.command('estimate.prepare',{jobId:retained.id,version:retained.version,lines:[{id:'synthetic-mallet-987-retained-line',kind:'labor',description:'Previously authorized inspection',quantity:1,unitCents:4200}]}))
 const key=await h.command('agent.create',{label:'synthetic-mallet-987-advisor'})
 const fixtures=[
  {door:'mcp',job:await repair('988'),lines:[{id:'synthetic-mallet-988-part',kind:'part',description:'Front brake pads',quantity:2,unitCents:2350},{id:'synthetic-mallet-988-labor',kind:'labor',description:'Front brake adjustment',quantity:1.25,unitCents:8000}],subtotal:14700,tax:1470,total:16170},
  {door:'legacy',job:await repair('989'),lines:[{id:'synthetic-mallet-989-part',kind:'part',description:'Rear brake cables',quantity:3,unitCents:1700},{id:'synthetic-mallet-989-labor',kind:'labor',description:'Rear cable adjustment',quantity:0.5,unitCents:9000}],subtotal:9600,tax:960,total:10560},
 ]
 const snapshot=async()=>({records:(await h.state()).records,mail:structuredClone(h.messages),outbound:structuredClone(outbound())})
 const audit=async key=>(await h.api('/agents/api/audit')).rows.filter(row=>row.idempotency_key===key)
 const invoke=async(f,keySuffix)=>{
  const idempotency='synthetic-mallet-'+f.door+'-'+keySuffix,input={jobId:f.job.id,version:f.job.version,lines:f.lines,notes:'synthetic-mallet-'+f.door+'-draft'}
  const response=await h.request(f.door==='mcp'?'/mcp':'/api/mallet/commands',{method:'POST',as:'',headers:{authorization:'Bearer '+key.token,'idempotency-key':idempotency,...(f.door==='mcp'?{'MCP-Protocol-Version':'2026-07-28','Mcp-Method':'tools/call','Mcp-Name':'mallet.estimates.prepare'}:{})},body:f.door==='mcp'?{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'mallet.estimates.prepare',arguments:{...input,idempotency_key:idempotency},_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28'}}}:{command:'estimate.prepare',input}})
  return {status:response.status,body:await response.json(),idempotency}
 }
 const blockedDocument=standardPolicy('blocked')
 await adopt(blockedDocument)
 const blocked=await policy()
 assert.equal(blocked.complete,true)
 assert.deepEqual(blocked.document,blockedDocument)
 for(const f of fixtures){
  const before=await snapshot(),answer=await invoke(f,'blocked')
  const refusal=f.door==='mcp'?answer.body.result?._meta?.[errorKey]:answer.body
  assert.equal(answer.status,f.door==='mcp'?200:403,f.door+' returns its public policy refusal')
  assert.deepEqual(refusal,{code:'policy_blocked',class:'standard',rule,revision:blocked.revision},f.door+' names the exact standard rule and adopted revision')
  assert.deepEqual(await snapshot(),before,f.door+' blocked preparation preserves all business records, customer decisions and outbound effects immediately')
  const rows=await audit(answer.idempotency)
  assert.equal(rows.length,1)
  assert.equal(rows[0].decision,'blocked');assert.equal(rows[0].outcome,'refused');assert.equal(rows[0].code,'policy_blocked');assert.equal(rows[0].revision,blocked.revision)
  assert.deepEqual(rows[0].rules,[{class:'standard',rule,do:'blocked'}])
 }
 await observe('blocked',{fixtures,blocked,authorized})
 const beforeAllowed=await snapshot(),changedAt=performance.now(),autonomousDocument=standardPolicy('autonomous')
 await adopt(autonomousDocument)
 const autonomous=await policy()
 assert.equal(autonomous.revision,blocked.revision+1)
 assert.deepEqual(autonomous.document,autonomousDocument)
 const drafts=[]
 for(const f of fixtures){
  const answer=await invoke(f,'fresh')
  assert.equal(answer.status,200,f.door+' next fresh-key preparation succeeds')
  assert.ok(performance.now()-changedAt<60000,f.door+' observes the changed policy within sixty seconds')
  const draft=f.door==='mcp'?answer.body.result?.structuredContent:answer.body
  assert.ok(draft?.id,f.door+' returns a saved native draft')
  const state=(await h.state()).records,saved=state.estimate.find(row=>row.id===draft.id)
  assert.deepEqual(saved,draft,'Public owner readback equals the returned draft')
  assert.equal(saved.jobId,f.job.id);assert.equal(saved.status,'draft');assert.equal(saved.version,1)
  assert.equal(saved.authorisation,null);assert.deepEqual(saved.sent,[]);assert.equal(saved.revisions.length,1)
  const revision=saved.revisions[0]
  assert.equal(revision.n,1);assert.equal(revision.approval,null)
  assert.deepEqual(revision.lines.map(({id,kind,description,quantity,unitCents})=>({id,kind,description,quantity,unitCents})),f.lines)
  assert.deepEqual(revision.lines.map(line=>line.quantityMilli),f.door==='mcp'?[2000,1250]:[3000,500])
  assert.equal(revision.totals.currency,'USD');assert.equal(revision.totals.subtotalCents,f.subtotal);assert.equal(revision.totals.salesTaxCents,f.tax);assert.equal(revision.totals.totalCents,f.total)
  assert.equal(revision.preparedBy.id,'mallet-key:'+key.id);assert.equal(revision.preparedBy.role,'agent')
  assert.equal(state.job.find(row=>row.id===f.job.id).estimateId,saved.id)
  const rows=await audit(answer.idempotency)
  assert.equal(rows.length,1)
  assert.equal(rows[0].decision,'autonomous');assert.equal(rows[0].outcome,'done');assert.equal(rows[0].revision,autonomous.revision)
  assert.deepEqual(rows[0].rules,[{class:'standard',rule,do:'autonomous'}])
  if(f.door==='mcp')assert.equal(answer.body.result._meta[decisionKey].revision,autonomous.revision)
  drafts.push(saved)
 }
 assert.notEqual(drafts[0].id,drafts[1].id)
 const after=await snapshot()
 assert.deepEqual(after.records.estimate.find(row=>row.id===authorized.id),authorized,'Preparation cannot alter a prior customer decision')
 assert.deepEqual(after.records.approval,beforeAllowed.records.approval,'No draft supplies a human approval')
 assert.deepEqual(after.mail,beforeAllowed.mail);assert.deepEqual(after.outbound,beforeAllowed.outbound,'Autonomous draft preparation has no outbound effect')
 assert.equal(after.records.estimate.length,beforeAllowed.records.estimate.length+2)
 await observe('autonomous',{fixtures,drafts,autonomous,authorized})
 return {blockedRevision:blocked.revision,autonomousRevision:autonomous.revision,drafts}
}
