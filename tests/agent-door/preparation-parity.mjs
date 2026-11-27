import assert from 'node:assert/strict'
import {installation} from '../harness.mjs'
import {nativeDoor,seedRepair,draftLines,dispatchReason,invoiceLines,invoiceTotals,actualQuantities} from './preparation-fixtures.mjs'

const pending=new Map(),proved=new Set()
const rows=(state,kind)=>state.records[kind]??[]
const jobAt=(state,id)=>rows(state,'job').find(row=>row.id===id)
const fields=(row,keys)=>Object.fromEntries(keys.map(key=>[key,row[key]]))
const assignmentKeys=['bayId','technicianId','startAt','endAt']

// Open a second installation with its own database and controlled mail edge.
export async function nativePeer(){
 const app=await installation({entry:'tests/agent-door/peer-worker.ts',assets:true})
 try{
  const request=(url,init)=>app.mf.dispatchFetch(url,{...init,signal:AbortSignal.timeout(30000)})
  const door=nativeDoor({request,origin:app.origin,cookie:app.owner})
  const setup=await door.send('/setup',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({confirm:'yes',displayName:'Synthetic Base 1',ratePercent:'10',partsTaxable:'on',laborTaxable:'on'}).toString()})
  assert.equal(setup.status,303);await setup.body?.cancel()
  const reviewer=await app.person('synthetic-mallet-961@example.invalid','admin')
  return {door,reviewer,messages:app.messages,close:app.close}
 }catch(error){await app.close();throw error}
}

// Submit the existing person form, including its actual hidden version fence.
async function nativeForm(door,path,command,input){
 const response=await door.send(path);assert.equal(response.status,200)
 const html=await response.text(),forms=[...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].map(match=>match[0])
 const form=forms.find(value=>value.includes(`name="command" value="${command}"`)&&value.includes(`name="jobId" value="${input.jobId}"`))
 assert.ok(form,'The native page offers the preparation on this exact repair')
 const hidden=Object.fromEntries([...form.matchAll(/<input type="hidden" name="([^"]+)" value="([^"]*)">/g)].map(match=>[match[1],match[2]]))
 assert.equal(Number(hidden.version),input.version,'Native form retains the exact source repair version')
 const submitted=await door.send('/app/actions',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...input,...hidden}).toString()})
 assert.equal(submitted.status,303,'Native preparation form succeeds');await submitted.body?.cancel()
}

export async function beforeStep(context){
 const {phase,step,args,outputs}=context
 if(!['autonomous','held'].includes(phase)||!['dispatch','invoice'].includes(step.id))return
 const source=nativeDoor(context),before=await source.state(),job=jobAt(before,args.jobId),asset=rows(before,'asset').find(row=>row.id===job.assetId)
 const index=Number(asset.identifier.replace('AGENT-',''))
 assert.ok(Number.isInteger(index)&&index>=0&&index<=3,'Preparation targets an independently specified repair fixture')
 const peer=await nativePeer()
 try{
  const fixture=await seedRepair(peer.door,index,peer.reviewer)
  if(step.id==='dispatch'){
   let quote=await peer.door.command('estimate.prepare',{jobId:fixture.job.id,version:fixture.job.version,lines:draftLines()})
   quote=await peer.door.command('estimate.revise',{estimateId:quote.id,version:quote.version,revision:1,lines:draftLines(),notes:'Fresh exact draft; a person still decides.'})
   fixture.estimate=quote
   assert.equal(outputs.revise.revisions.at(-1).n,2)
   const bay=await peer.door.command('calendar.resourceSave',{kind:'bay',name:'Diagnostic bench',skills:[],active:true})
   fixture.proposedBay=bay.id
  }
  const nativeBefore=await peer.door.state(),nativeJob=jobAt(nativeBefore,fixture.job.id)
  assert.equal(job.version,nativeJob.version,'Independent repairs have the same source revision')
  const mapping={asset:[asset.id,fixture.asset.id],job:[job.id,nativeJob.id],technician:[job.technicianId,nativeJob.technicianId],estimate:[job.estimateId,nativeJob.estimateId]}
  assert.notEqual(...mapping.asset);assert.notEqual(...mapping.job);assert.notEqual(...mapping.technician);assert.notEqual(...mapping.estimate)
  assert.deepEqual(fields(job,['title','status','bayId','startAt','endAt']),fields(nativeJob,['title','status','bayId','startAt','endAt']),'Equivalent independently seeded repair state')
  const input={jobId:nativeJob.id,version:nativeJob.version,...(step.id==='dispatch'?{bayId:fixture.proposedBay,technicianId:nativeJob.technicianId,startAt:`2028-11-${10+index}T09:00:00.000Z`,endAt:`2028-11-${10+index}T10:00:00.000Z`,reason:dispatchReason}:{})}
  if(step.id==='dispatch'){
   assert.deepEqual(fields(args,['bayId','technicianId','startAt','endAt','reason']),{bayId:'Diagnostic bench',technicianId:job.technicianId,startAt:input.startAt,endAt:input.endAt,reason:dispatchReason})
   mapping.proposedBay=[args.bayId,fixture.proposedBay]
  }
  const proof={context,source,before,job,peer,fixture,nativeBefore,nativeJob,mapping,input}
  const path=step.id==='dispatch'?'/app/calendar':'/app/jobs/'+nativeJob.id,command=step.id==='dispatch'?'dispatch.prepare':'invoice.prepare'
  await nativeForm(peer.door,path,command,input)
  pending.set(phase+':'+step.id,proof)
 }catch(error){await peer.close();throw error}
}

function assertAttribution(actor,owner){
 assert.equal(actor.role,'agent')
 assert.equal(actor.id,actor.attribution.agent.id)
 assert.deepEqual(actor.attribution.for,{id:owner.id,name:owner.name})
 assert.equal(actor.attribution.label,`${actor.attribution.agent.name} for ${owner.name}`)
 assert.equal(actor.name,actor.attribution.label)
}
function assertInvoice(invoice,job,quote){
 assert.equal(invoice.jobId,job.id);assert.equal(invoice.jobVersion,job.version)
 assert.equal(invoice.estimateId,quote.id);assert.equal(invoice.estimateRevision,2)
 assert.equal(invoice.revision,1);assert.equal(invoice.status,'draft');assert.equal(invoice.approval,null);assert.equal(invoice.exportId,null)
 assert.deepEqual(invoice.totals,invoiceTotals)
 assert.deepEqual(invoice.customer,job.asset)
 assert.deepEqual(invoice.actuals,job.actuals,'Invoice retains the exact authorized actual records')
 assert.equal(invoice.lines.length,2);assert.equal(invoice.actuals.length,2)
 const expected=[{quantity:2,quantityMilli:2000,subtotalCents:5000,salesTaxCents:500,totalCents:5500},{quantity:0.75,quantityMilli:750,subtotalCents:9000,salesTaxCents:900,totalCents:9900}]
 const lines=invoiceLines()
 for(const [i,line] of invoice.lines.entries()){
  assert.deepEqual(line,{...lines[i],...expected[i],id:quote.revisions[1].lines[i].id,taxable:true,taxRatePercent:10,taxRateMillionths:100000,pierItemId:null,sourceEstimateId:quote.id,sourceRevision:2})
  const actual=invoice.actuals[i]
  assert.equal(actual.estimateId,quote.id);assert.equal(actual.revision,2);assert.equal(actual.lineId,line.id)
  assert.equal(actual.quantity,actualQuantities[i]);assert.equal(actual.quantityMilli,expected[i].quantityMilli)
 }
 assert.deepEqual(invoice.sources.map(source=>fields(source,['estimateId','revision','approval','customerAuthorisation','supplementOf'])),[{estimateId:quote.id,revision:2,approval:quote.revisions[1].approval,customerAuthorisation:quote.authorisation,supplementOf:null}])
 assert.deepEqual(invoice.estimateApproval,quote.revisions[1].approval);assert.deepEqual(invoice.customerAuthorisation,quote.authorisation)
}

export async function afterStep({phase,step,result}){
 const key=phase+':'+step.id,proof=pending.get(key)
 if(!proof)return
 const {source,before,job,peer,nativeBefore,nativeJob,fixture,input,mapping}=proof
 try{
  const after=await source.state(),nativeAfter=await peer.door.state(),kind=step.id==='dispatch'?'proposal':'invoice',command=step.id==='dispatch'?'dispatch.prepare':'invoice.prepare'
  const actual=rows(after,kind).find(row=>row.id===result.id),native=rows(nativeAfter,kind).find(row=>row.jobId===nativeJob.id)
  assert.ok(actual&&native,'Both public doors persist a prepared record')
  assert.deepEqual(result,actual,'MCP result equals the persisted native record')
  assertAttribution(actual.preparedBy,after.actor)
  assert.deepEqual(native.preparedBy,nativeAfter.actor,'The owner form retains person attribution')
  for(const [state,owner,row,target] of [[after,after.actor,actual,job],[nativeAfter,nativeAfter.actor,native,nativeJob]]){
   const events=rows(state,'event').filter(event=>event.jobId===target.id&&event.kind===command)
   assert.equal(events.length,1,'Exactly one matching native business event per preparation')
   assert.equal(events[0].subjectId,row.id);assert.deepEqual(events[0].actor,row.preparedBy)
   const audits=rows(state,'audit').filter(entry=>entry.action===command&&entry.changes.some(change=>change.kind===kind&&change.id===row.id))
   assert.equal(audits.length,1,'Exactly one matching native audit entry per preparation')
   assert.deepEqual(audits[0].actor,row.preparedBy)
   if(row===actual)assertAttribution(events[0].actor,owner)
   assert.equal(rows(state,'approval').filter(approval=>approval.subjectId===row.id).length,0,'Preparation grants no native decision')
   assert.equal(rows(state,'export').filter(entry=>entry.invoiceId===row.id).length,0,'Preparation creates no export')
  }
  if(step.id==='dispatch'){
   const expected={liftId:'',loanerId:'',requiredSkill:'',bayId:'Diagnostic bench',technicianId:job.technicianId,startAt:new Date(input.startAt).toISOString(),endAt:new Date(input.endAt).toISOString()}
   assert.deepEqual(actual.plan,expected)
   assert.deepEqual(native.plan,{...expected,bayId:mapping.proposedBay[1],technicianId:mapping.technician[1]})
   for(const [row,target,state,prior] of [[actual,job,after,before],[native,nativeJob,nativeAfter,nativeBefore]]){
    assert.equal(row.jobId,target.id);assert.equal(row.jobVersion,target.version);assert.equal(row.reason,dispatchReason);assert.equal(row.status,'pending')
    assert.deepEqual(jobAt(state,target.id),jobAt(prior,target.id),'Dispatch preparation leaves the entire actual repair assignment unchanged')
    assert.deepEqual(fields(jobAt(state,target.id),assignmentKeys),fields(target,assignmentKeys))
   }
  }else{
   const quote=rows(before,'estimate').find(row=>row.id===job.estimateId)
   assertInvoice(actual,job,quote);assertInvoice(native,nativeJob,fixture.estimate)
   mapping.lines=quote.revisions[1].lines.map((line,i)=>[line.id,fixture.estimate.revisions[1].lines[i].id])
   assert.deepEqual(actual.lines.map((line,i)=>({...line,id:mapping.lines[i][1],sourceEstimateId:mapping.estimate[1]})),native.lines,'Exact prepared lines agree after explicit source identity mapping')
   for(const [state,prior,target,row] of [[after,before,job,actual],[nativeAfter,nativeBefore,nativeJob,native]]){
    assert.deepEqual(jobAt(state,target.id),{...jobAt(prior,target.id),version:target.version+1,invoiceId:row.id},'Invoice preparation changes only the source version and invoice link')
    assert.deepEqual(rows(state,'approval'),rows(prior,'approval'));assert.deepEqual(rows(state,'export'),rows(prior,'export'))
   }
   for(const [door,row,state] of [[source,actual,after],[peer.door,native,nativeAfter]]){
    const refused=await door.send('/api/mallet/commands',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command:'invoice.export',input:{invoiceId:row.id,version:row.version}})})
    assert.equal(refused.status,409);assert.equal((await refused.json()).error,'NOT_APPROVED')
    assert.deepEqual((await door.state()).records,state.records,'Unapproved prepared invoices cannot be exported and change nothing')
   }
  }
  proved.add(key)
  console.log(`PROBE BASE-AGENT-002 ${phase} ${step.id}: independent owner form and MCP preparation -> exact state, source revisions, one business event, separate attribution; no approval or export`)
 }finally{pending.delete(key);await peer.close()}
}

export default async function preparationParity(){
 try{
  for(const phase of ['autonomous','held'])for(const step of ['dispatch','invoice'])assert.ok(proved.has(phase+':'+step),'Both native preparation comparisons run under '+phase+' policy')
 }finally{
  proved.clear()
  for(const proof of pending.values()){await proof.peer.close()}
  pending.clear()
 }
 console.log('BASE-AGENT-002 point 5: independently seeded dispatch and invoice preparations match through production doors under autonomous and standard-review policies.')
}
