import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {serveHosted} from '@runeditrun/rer/internal/cli/hosted-output.mjs'
import {nativeDoor,seedRepair,draftLines,revisedLines,revisedNotes,estimateForm,dispatchReason,invoiceLines,invoiceTotals,actualQuantities} from './preparation-fixtures.mjs'
import {estimateParity} from './estimate-parity.mjs'
import {refusalParity} from './refusal-parity.mjs'

const pending=new Map(),proved=new Set()
let browserProof
export function usePreparationBrowser(driver){browserProof=driver}
const rows=(state,kind)=>state.records[kind]??[]
const jobAt=(state,id)=>rows(state,'job').find(row=>row.id===id)
const fields=(row,keys)=>Object.fromEntries(keys.map(key=>[key,row[key]]))
const assignmentKeys=['bayId','technicianId','startAt','endAt']
const compared=['prepare','revise','dispatch','invoice']
// Each preparation's owner page, form command and the hidden field naming its exact source record.
const nativeAction={prepare:['estimate.prepare','jobId'],revise:['estimate.revise','estimateId'],dispatch:['dispatch.prepare','jobId'],invoice:['invoice.prepare','jobId']}

// A second emitted production Worker has its own database, native owner,
// independently confirmed quality reviewer, and synthetic mail boundary.
export async function nativePeer(){
 const token=randomBytes(32).toString('hex'),messages=[]
 const hosted=await serveHosted(process.cwd(),{bindings:{SETUP_TOKEN:token,OWNER_EMAIL:['synthetic-mallet-960','example.invalid'].join('@')},outboundService:async request=>{
  assert.equal(new URL(request.url).hostname,'api.resend.com')
  messages.push(await request.json());return Response.json({id:crypto.randomUUID()})
 }})
 const request=(url,init)=>hosted.fetch(url.slice(hosted.origin.length+1),{...init,signal:AbortSignal.timeout(30000)})
 try{
  const boot=await request(hosted.origin+'/auth/bootstrap',{method:'POST',headers:{Origin:hosted.origin,'Content-Type':'application/json'},body:JSON.stringify({token,displayName:'Synthetic Base 1',returnTo:'/setup'})})
  assert.equal(boot.status,303,'Independent native owner bootstrap')
  const cookie=boot.headers.getSetCookie().map(value=>value.split(';',1)[0]).join('; ')
  await boot.body?.cancel()
  const door=nativeDoor({request,origin:hosted.origin,cookie})
  const setup=await door.send('/setup',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({confirm:'yes',displayName:'Synthetic Base 1',ratePercent:'10',partsTaxable:'on',laborTaxable:'on'}).toString()})
  assert.equal(setup.status,303);await setup.body?.cancel()
  const email=['synthetic-mallet-961','example.invalid'].join('@')
  const invited=await door.send('/auth/invite',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,displayName:'Cedar Independent Reviewer',role:'admin'})})
  assert.equal(invited.status,202);await invited.body?.cancel()
  const message=messages.findLast(value=>JSON.stringify(value.to).includes(email))
  assert.ok(message,'Independent native reviewer invitation reaches the controlled mail edge')
  const link=new URL(message.text.match(/https:\/\/[^\s]+/)[0])
  const confirmed=await request(hosted.origin+'/auth/confirm',{method:'POST',headers:{Origin:hosted.origin,'Content-Type':'application/json'},body:JSON.stringify({token:link.searchParams.get('token')})})
  assert.equal(confirmed.status,303)
  const reviewer={cookie:confirmed.headers.getSetCookie().map(value=>value.split(';',1)[0]).join('; ')}
  await confirmed.body?.cancel()
  return {door,reviewer,close:()=>hosted.close()}
 }catch(error){await hosted.close();throw error}
}

// Submit the existing person form, including its actual hidden version fence.
// The browser registration replaces this driver with clicks on the same form.
async function nativeForm(door,path,command,input,key){
 const response=await door.send(path);assert.equal(response.status,200)
 const html=await response.text(),forms=[...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].map(match=>match[0])
 const form=forms.find(value=>value.includes(`name="command" value="${command}"`)&&value.includes(`name="${key}" value="${input[key]}"`))
 assert.ok(form,'The native page offers the preparation on this exact repair')
 const hidden=Object.fromEntries([...form.matchAll(/<input type="hidden" name="([^"]+)" value="([^"]*)">/g)].map(match=>[match[1],match[2]]))
 assert.equal(Number(hidden.version),input.version,'Native form retains the exact source repair version')
 const submitted=await door.send('/app/actions',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...input,...hidden}).toString()})
 assert.equal(submitted.status,303,'Native preparation form succeeds');await submitted.body?.cancel()
}

// A person approves the agent's revision one after it is prepared: the native
// door allows this until the customer authorizes, so the agent's next revision
// lands beside a historical owner decision on revision one.
async function approveRevisionOne(source,estimate){
 const approved=await source.command('estimate.approve',{estimateId:estimate.id,version:estimate.version,revision:1})
 assert.equal(approved.status,'approved');assert.ok(approved.revisions[0].approval,'The owner decided revision one')
}

export async function beforeStep(context){
 const {phase,step,args,outputs}=context
 if(!['autonomous','held'].includes(phase)||!compared.includes(step.id))return
 const source=nativeDoor(context)
 const before=await source.state()
 const sourceEstimate=step.id==='revise'?rows(before,'estimate').find(row=>row.id===args.estimateId):undefined
 const job=jobAt(before,sourceEstimate?.jobId??args.jobId),asset=rows(before,'asset').find(row=>row.id===job.assetId)
 const index=Number(asset.identifier.replace('AGENT-',''))
 assert.ok(Number.isInteger(index)&&index>=0&&index<=3,'Preparation targets an independently specified repair fixture')
 const peer=await nativePeer()
 let browser
 try{
  const fixture=await seedRepair(peer.door,index,peer.reviewer)
  const proposedTechnician=(await source.json('/auth/operators')).find(person=>person.displayName==='Cedar Independent Reviewer')
  const nativeTechnician=(await peer.door.json('/auth/operators')).find(person=>person.displayName==='Cedar Independent Reviewer')
  assert.ok(proposedTechnician&&nativeTechnician,'Each installation has its independently confirmed proposed technician')
  // The revised estimate starts from the same exact revision one the agent prepared.
  if(step.id==='revise'){
   const drafted=await peer.door.command('estimate.prepare',{jobId:fixture.job.id,version:fixture.job.version,lines:draftLines()})
   fixture.estimate=await peer.door.command('estimate.approve',{estimateId:drafted.id,version:drafted.version,revision:1})
  }
  if(step.id==='dispatch'){
   let quote=await peer.door.command('estimate.prepare',{jobId:fixture.job.id,version:fixture.job.version,lines:draftLines()})
   quote=await peer.door.command('estimate.revise',{estimateId:quote.id,version:quote.version,revision:1,lines:revisedLines(),notes:revisedNotes})
   fixture.estimate=quote
   assert.equal(outputs.revise.revisions.at(-1).n,2)
   const bay=await peer.door.command('calendar.resourceSave',{kind:'bay',name:'Diagnostic bench',skills:[],active:true})
   fixture.proposedBay=bay.id
  }
  const nativeBefore=await peer.door.state(),nativeJob=jobAt(nativeBefore,fixture.job.id)
  assert.equal(job.version,nativeJob.version,'Independent repairs have the same source revision')
  const mapping={asset:[asset.id,fixture.asset.id],job:[job.id,nativeJob.id],technician:[job.technicianId,nativeJob.technicianId],estimate:[job.estimateId??null,nativeJob.estimateId??null]}
  assert.notEqual(...mapping.asset);assert.notEqual(...mapping.job);assert.notEqual(...mapping.technician)
  if(step.id==='prepare')assert.deepEqual(mapping.estimate,[null,null],'Neither repair has an estimate before preparation')
  else assert.notEqual(...mapping.estimate)
  assert.deepEqual(fields(job,['title','status','bayId','startAt','endAt']),fields(nativeJob,['title','status','bayId','startAt','endAt']),'Equivalent independently seeded repair state')
  const nativeEstimate=step.id==='revise'?rows(nativeBefore,'estimate').find(row=>row.id===nativeJob.estimateId):undefined
  let input={jobId:nativeJob.id,version:nativeJob.version,...(step.id==='dispatch'?{bayId:fixture.proposedBay,technicianId:nativeTechnician.id,startAt:'2028-11-20T13:15:00-05:00',endAt:'2028-11-20T14:45:00-05:00',reason:dispatchReason}:{})}
  if(step.id==='prepare'){
   assert.deepEqual(args.lines,draftLines(),'The MCP preparation uses the independently specified lines');assert.equal(args.notes,undefined)
   input={...input,...estimateForm(args.lines)}
  }
  if(step.id==='revise'){
   assert.deepEqual(fields(args,['revision','lines','notes']),{revision:1,lines:revisedLines(),notes:revisedNotes},'The MCP revision uses the independently specified lines')
   assert.deepEqual(sourceEstimate.revisions.map(revision=>revision.lines.map(({id,...line})=>line)),nativeEstimate.revisions.map(revision=>revision.lines.map(({id,...line})=>line)),'Equivalent exact revision one on both repairs')
   assert.equal(sourceEstimate.version,nativeEstimate.version)
   mapping.estimate=[sourceEstimate.id,nativeEstimate.id]
   input={estimateId:nativeEstimate.id,version:nativeEstimate.version,revision:1,...estimateForm(args.lines,args.notes)}
  }
  if(step.id==='dispatch'){
   assert.deepEqual(fields(args,['bayId','technicianId','startAt','endAt','reason']),{bayId:'Diagnostic bench',technicianId:proposedTechnician.id,startAt:input.startAt,endAt:input.endAt,reason:dispatchReason})
   mapping.proposedBay=[args.bayId,fixture.proposedBay]
   mapping.proposedTechnician=[proposedTechnician.id,nativeTechnician.id]
   assert.notEqual(...mapping.proposedTechnician)
   for(const [requested,current] of [[args,job],[input,nativeJob]])for(const field of assignmentKeys)assert.notEqual(requested[field],current[field],'The proposed '+field+' differs from the actual assignment')
  }
  const proof={context,source,before,job,peer,fixture,nativeBefore,nativeJob,mapping,input,sourceEstimate,nativeEstimate}
  if(browserProof)browser=proof.browser=await browserProof(proof)
  const path=step.id==='dispatch'?'/app/calendar':'/app/jobs/'+nativeJob.id,[command,key]=nativeAction[step.id]
  if(proof.browser)await proof.browser.prepare(path,command,input,key)
  else await nativeForm(peer.door,path,command,input,key)
  pending.set(phase+':'+step.id,proof)
 }catch(error){await browser?.close();await peer.close();throw error}
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

export async function afterStep(context){
 const {phase,step,result}=context
 if(step.id==='read'&&['autonomous','held'].includes(phase)){
  const codes=await refusalParity(context,nativeDoor(context),{step:'read'})
  proved.add(phase+':read');console.log(`PROBE BASE-AGENT-002 ${phase} read refusal: owner repair route and MCP missing repair -> ${codes.join(', ')}`)
  return
 }
 const key=phase+':'+step.id,proof=pending.get(key)
 if(!proof)return
 const {source,before,job,peer,nativeBefore,nativeJob,fixture,input,mapping}=proof
 try{
  const after=await source.state(),nativeAfter=await peer.door.state()
  if(['prepare','revise'].includes(step.id)){
   const {actual,native}=estimateParity({step:step.id,result,after,before,nativeAfter,nativeBefore,job,nativeJob,sourceEstimate:proof.sourceEstimate,nativeEstimate:proof.nativeEstimate,assertAttribution})
   const codes=await refusalParity(context,source,{step:step.id,job,result,estimate:proof.sourceEstimate})
   if(proof.browser)await proof.browser.readback({actual,native,after,nativeAfter})
   if(step.id==='prepare')await approveRevisionOne(source,result)
   proved.add(key)
   console.log(`PROBE BASE-AGENT-002 ${phase} ${step.id}: independent owner form and MCP estimate ${step.id} -> exact lines, totals and revision, one business event, separate attribution, no decision; refusals ${codes.join(', ')} equal the UI codes`)
   return
  }
  const kind=step.id==='dispatch'?'proposal':'invoice',command=step.id==='dispatch'?'dispatch.prepare':'invoice.prepare'
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
   const expected={liftId:'',loanerId:'',requiredSkill:'',bayId:'Diagnostic bench',technicianId:mapping.proposedTechnician[0],startAt:'2028-11-20T18:15:00.000Z',endAt:'2028-11-20T19:45:00.000Z'}
   assert.deepEqual(actual.plan,expected)
   assert.deepEqual(native.plan,{...expected,bayId:mapping.proposedBay[1],technicianId:mapping.proposedTechnician[1]})
   for(const [row,target,state,prior] of [[actual,job,after,before],[native,nativeJob,nativeAfter,nativeBefore]]){
    assert.equal(row.jobId,target.id);assert.equal(row.jobVersion,target.version);assert.equal(row.reason,dispatchReason);assert.equal(row.status,'pending')
    assert.deepEqual(jobAt(state,target.id),jobAt(prior,target.id),'Dispatch preparation leaves the entire actual repair assignment unchanged')
    assert.deepEqual(fields(jobAt(state,target.id),assignmentKeys),fields(target,assignmentKeys))
    assert.deepEqual(rows(state,'event').find(event=>event.kind==='dispatch.prepare'&&event.subjectId===row.id).data,{plan:row.plan,conflicts:[]},'The native business event retains the exact proposed move')
    assert.deepEqual(rows(state,'approval'),rows(prior,'approval'),'A proposed move adds no decision')
   }
  }else{
   const quote=rows(before,'estimate').find(row=>row.id===job.estimateId)
   assertInvoice(actual,job,quote);assertInvoice(native,nativeJob,fixture.estimate)
   mapping.lines=quote.revisions[1].lines.map((line,i)=>[line.id,fixture.estimate.revisions[1].lines[i].id])
   assert.deepEqual(actual.lines.map((line,i)=>({...line,id:mapping.lines[i][1],sourceEstimateId:mapping.estimate[1]})),native.lines,'Exact prepared lines agree after explicit source identity mapping')
   for(const [state,prior,target,row] of [[after,before,job,actual],[nativeAfter,nativeBefore,nativeJob,native]]){
    assert.deepEqual(jobAt(state,target.id),{...jobAt(prior,target.id),version:target.version+1,invoiceId:row.id},'Invoice preparation changes only the source version and invoice link')
    assert.deepEqual(rows(state,'approval'),rows(prior,'approval'));assert.deepEqual(rows(state,'export'),rows(prior,'export'))
    assert.deepEqual(rows(state,'estimate'),rows(prior,'estimate'),'Invoice preparation preserves every frozen estimate decision')
    assert.deepEqual(rows(state,'event').find(event=>event.kind==='invoice.prepare'&&event.subjectId===row.id).data,{revision:1,totals:invoiceTotals,estimateId:row.estimateId,estimateRevision:2},'The native business event cites exact frozen source amounts and revision')
   }
   for(const [door,row,state] of [[source,actual,after],[peer.door,native,nativeAfter]]){
    const refused=await door.send('/api/mallet/commands',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command:'invoice.export',input:{invoiceId:row.id,version:row.version}})})
    assert.equal(refused.status,409);assert.equal((await refused.json()).error,'NOT_APPROVED')
    assert.deepEqual((await door.state()).records,state.records,'Unapproved prepared invoices cannot be exported and change nothing')
   }
  }
  const codes=await refusalParity(context,source,{step:step.id,job,result,dispatch:fields(context.args,assignmentKeys)})
  if(proof.browser)await proof.browser.readback({actual,native,after,nativeAfter})
  proved.add(key)
  console.log(`PROBE BASE-AGENT-002 ${phase} ${step.id}: independent owner form and MCP preparation -> exact state, source revisions, one business event, separate attribution; no approval or export; refusals ${codes.join(', ')} equal the UI codes`)
 }finally{pending.delete(key);await proof.browser?.close();await peer.close()}
}

export default async function preparationParity(){
 try{
  for(const phase of ['autonomous','held'])for(const step of [...compared,'read'])assert.ok(proved.has(phase+':'+step),'Every native preparation comparison and refusal check runs under '+phase+' policy')
 }finally{
  proved.clear()
  for(const proof of pending.values()){await proof.browser?.close();await proof.peer.close()}
  pending.clear()
 }
 console.log('BASE-AGENT-002 points 4 and 5: independently seeded estimate, revision, dispatch and invoice preparations match the owner forms, and every refusal returns the UI code, under autonomous and standard-review policies.')
}
