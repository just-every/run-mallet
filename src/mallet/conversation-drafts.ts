import {createHash} from 'node:crypto'
import {bump,choice,event,expectVersion,fail,find,put,rows,text,who,type Context,type Handler,type Row,type State} from './model'

export const conversationCommands=['conversation.capture','conversation.redraft','conversation.review']
export const conversationDisclosure='Machine-assisted factual template. Private owner review only; no customer message sent.'
export const conversationQuestions={inspection:'What did the inspection find?',estimate:'What is the approved estimate price?'}
const hash=(value:any)=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const currency=(cents:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100)
const native=(s:State,kind:string,id:string)=>rows(s,kind).find(r=>r.id===id)
function repair(s:State,id:string){
 const job=find(s,'job',id),asset=find(s,'asset',job.assetId),account=asset.customerAccountId?native(s,'customerAccount',asset.customerAccountId):null
 if(asset.privacyErasedAt||account?.privacyErasedAt||job.mediaErasedAt)fail('CONVERSATION_ERASED','This repair is unavailable for conversation drafting.')
 return {job,asset,account}
}
function reference(kind:string,row:Row,extra:any={}){return {kind,id:row.id,version:row.version,...extra}}

/** Templates read only the reviewed customer report and shared approved prices.
 * Questions are staff-entered evidence, never authenticated channel receipts. */
function proposal(c:Context,jobId:string,question:string,topic:string,selected:any){
 const {job,asset,account}=repair(c.s,jobId),citations:any[]=[],reasons:string[]=[],facts:string[]=[]
 const report=selected.reportId?find(c.s,'inspectionReport',selected.reportId):null
 const estimate=selected.estimateId?find(c.s,'estimate',selected.estimateId):null
 if(report&&report.jobId!==jobId||estimate&&estimate.jobId!==jobId)fail('CONVERSATION_SCOPE','Sources must belong to this exact repair and customer.',null,400)
 const contacts=account?(account.contactIds??[]).map((id:string)=>native(c.s,'contact',id)).filter(Boolean):[]
 const recipient=contacts.find((r:Row)=>r.id===(asset.driverContactId??account?.driverId??account?.billingContactId))
 const recipientAddress=recipient?.email??asset.customerEmail
 const sourceState:any={contacts:contacts.map((r:Row)=>reference('contact',r)),job:reference('job',job),asset:reference('asset',asset),account:account?reference('customerAccount',account):null,report:null,estimate:null,delivery:null,link:null,inspections:[]}
 if(!report)reasons.push('Missing explicitly shared inspection report.')
 if(report){
  citations.push(reference('inspectionReport',report,{label:report.title,href:'/app/jobs/'+job.id+'#inspection-reports'}));sourceState.report=reference('inspectionReport',report)
  const delivery=rows(c.s,'inspectionReportDelivery').findLast(d=>d.reportId===report.id&&d.to===recipientAddress&&d.status==='accepted')
  const link=delivery&&native(c.s,'diagnosisLink',delivery.linkId)
  if(!delivery||!link||link.revokedAt||link.expiresAt<=c.now||link.reportId!==report.id)reasons.push('No current shared-report handoff to the current customer; handoff is not receipt.')
  if(delivery){sourceState.delivery=reference('inspectionReportDelivery',delivery);citations.push(reference('inspectionReportDelivery',delivery,{label:'Recorded report handoff; receipt not established'}))}
  if(link)sourceState.link=reference('diagnosisLink',link)
  for(const entry of report.entries){
   const inspection=native(c.s,'inspection',entry.inspectionId),result=inspection?.results.find((r:any)=>r.id===entry.resultId)
   sourceState.inspections.push(inspection?reference('inspection',inspection):null)
   if(!inspection||inspection.jobId!==jobId||inspection.version!==entry.inspectionVersion||!result||inspection.results.findLast((r:any)=>r.itemId===result.itemId)?.id!==result.id)reasons.push('Inspection evidence changed; prepare and share a fresh reviewed report.')
   citations.push({kind:'inspection',id:entry.inspectionId,version:entry.inspectionVersion,resultId:entry.resultId,label:entry.label,href:'/app/jobs/'+job.id+'#inspections'})
   const measured=entry.measurement?` ${entry.measurement.name}: ${entry.measurement.value} ${entry.measurement.unit}.`:''
   facts.push(`${entry.label}: recorded urgency ${entry.urgency}.${measured} ${entry.explanation}`)
  }
 }
 let revision:any=null
 if(!estimate)reasons.push('Missing person-approved shared estimate revision.')
 if(estimate){
  revision=estimate.revisions.at(-1)
  sourceState.estimate=reference('estimate',estimate,{revision:revision.n})
  citations.push(reference('estimate',estimate,{revision:revision.n,label:'Person-approved estimate',href:'/app/jobs/'+job.id}))
  if(selected.revision!==revision.n||!revision.approval||!estimate.sent.some((r:any)=>r.revision===revision.n))reasons.push('The exact current estimate revision must be person-approved and explicitly shared.')
  if(report?.entries.some((entry:any)=>entry.proposal.estimateId!==estimate.id||entry.proposal.revision!==revision.n))reasons.push('Report prices do not cite this exact estimate revision.')
 }
 if(!Object.hasOwn(conversationQuestions,topic)||question!==conversationQuestions[topic as keyof typeof conversationQuestions])reasons.push('Question is ambiguous or outside the supported factual templates; a person must answer.')
 if(/\b(safe|safety|drive|guarantee|disput\w*|discount\w*|cheaper|refund\w*|add|extra|scope)\b/i.test(question))reasons.push('Safety, dispute, discount or scope request requires human escalation.')
 const escalation=[...new Set(reasons)]
 const answer=topic==='inspection'?facts.join('\n'):revision?`Person-approved estimate revision ${revision.n}:\n${revision.lines.map((l:any)=>`${l.description}: quantity ${l.quantity}; unit price ${currency(l.unitCents-(l.unitDiscountCents??0))}; line total ${currency(l.totalCents)}.`).join('\n')}\nTotal including recorded tax: ${currency(revision.totals.totalCents)}.`:''
 const content=conversationDisclosure+'\n'+(escalation.length?'Human escalation required. No factual answer prepared.':answer+'\nThis draft records shared facts only. Any customer decision must use the separate estimate approval process.')
 return {n:0,basis:hash(sourceState),sources:{reportId:report?.id??null,estimateId:estimate?.id??null,revision:revision?.n??null},citations,content,contentHash:hash(content),outcome:escalation.length?'escalated':'draft',reasons:escalation,at:c.now,by:who(c)}
}
function current(c:Context,row:Row){
 const revision=row.revisions.at(-1)
 if(row.privacyErasedAt)return {stale:true,revision:null}
 try{const now=proposal(c,row.jobId,row.question,row.topic,revision.sources);return {stale:now.basis!==revision.basis||JSON.stringify(now.reasons)!==JSON.stringify(revision.reasons),revision}}
 catch{return {stale:true,revision}}
}
export function conversationView(s:State,jobId:string,now=new Date().toISOString()){
 const {job}=repair(s,jobId),c:Context={s,now,actor:{id:'view',name:'Private view',role:'owner'}}
 return {job:{id:job.id,title:job.title},reports:rows(s,'inspectionReport').filter(r=>r.jobId===jobId).map(r=>({id:r.id,title:r.title})),estimates:rows(s,'estimate').filter(r=>r.jobId===jobId).map(r=>({id:r.id,revision:r.revisions.at(-1).n})),drafts:rows(s,'conversationDraft').filter(r=>r.jobId===jobId).map(row=>({...row,...current(c,row)}))}
}
export const conversationDrafts:Handler=(c,command,p)=>{
 if(!conversationCommands.includes(command))return
 if(c.actor.role!=='owner')fail('FORBIDDEN','Only the current owner reviews private conversation drafts.',null,403)
 const {job}=repair(c.s,text(p.jobId,'repair'))
 if(command==='conversation.capture'){
  const captureReference=text(p.captureReference,'capture reference'),question=text(p.question,'entered customer question',4000),source=choice(p.source,['telephone','in-person','entered-email','entered-transcript'],'stated source'),evidence=text(p.evidence,'source evidence reference',2000),topic=choice(p.topic,['inspection','estimate','human'],'question topic')
  const enteredAt=text(p.enteredAt,'customer statement time',100)
  if(!Number.isFinite(Date.parse(enteredAt))||!/(Z|[+-]\d\d:\d\d)$/.test(enteredAt))fail('INPUT','Record the statement time with a timezone or UTC offset.',null,400)
  const fingerprint=hash({question,source,evidence,topic,enteredAt,reportId:p.reportId??null,estimateId:p.estimateId??null,revision:p.revision??null})
  const prior=rows(c.s,'conversationDraft').find(r=>r.jobId===job.id&&r.captureReference===captureReference)
  if(prior){if(prior.privacyErasedAt||prior.captureHash!==fingerprint)fail('CONVERSATION_REPLAY','This capture reference already belongs to another or erased question.');return prior}
  const revision={...proposal(c,job.id,question,topic,p),n:1}
  const row=put(c.s,'conversationDraft',{jobId:job.id,captureReference,captureHash:fingerprint,question,topic,source,evidence,enteredAt,recordedAt:c.now,by:who(c),authenticatedReceipt:false,disclosure:conversationDisclosure,revisions:[revision],reviews:[]})
  event(c,command,job.id,row.id,{revision:1,outcome:revision.outcome});return row
 }
 const row=find(c.s,'conversationDraft',p.draftId);if(row.jobId!==job.id)fail('CONVERSATION_SCOPE','This draft belongs to another repair.',null,400)
 if(row.privacyErasedAt)fail('CONVERSATION_ERASED','Erased conversation content cannot be reused.')
 expectVersion(row,p.version)
 if(command==='conversation.redraft'){
  const revision={...proposal(c,job.id,row.question,row.topic,p),n:row.revisions.length+1}
  const next=bump(c.s,'conversationDraft',row,{revisions:[...row.revisions,revision]});event(c,command,job.id,row.id,{revision:revision.n,outcome:revision.outcome});return next
 }
 const {stale,revision}=current(c,row)
 if(stale)fail('CONVERSATION_STALE','Sources changed. Prepare a fresh draft before review.')
 if(p.revision!==revision.n||p.content!==revision.content)fail('CONVERSATION_EXACT','Review the exact current draft text and revision.')
 const decision=choice(p.decision,['approved','escalated','rejected'],'review decision')
 if(decision==='approved'&&revision.outcome==='escalated')fail('CONVERSATION_ESCALATION','An escalation cannot be approved as a factual answer.')
 const review={revision:revision.n,content:revision.content,contentHash:revision.contentHash,basis:revision.basis,decision,note:text(p.note,'owner review note',2000),at:c.now,by:who(c)}
 const next=bump(c.s,'conversationDraft',row,{reviews:[...row.reviews,review]});event(c,command,job.id,row.id,{revision:revision.n,decision});return next
}
