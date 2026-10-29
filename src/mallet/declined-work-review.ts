import {createHash} from 'node:crypto'
import {bump,event,expectVersion,fail,find,put,rows,who,type Handler,type Row,type State} from './model'
import {readings} from './mileage'
import {calendarReservations} from './calendar-capacity'
import {optedOut} from './approval-chasing'

export const declinedReviewCommands=['declineReview.refresh','declineReview.prepare']
const hash=(value:any)=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const ordered=(values:Row[])=>[...values].sort((a,b)=>a.id.localeCompare(b.id))
const citation=(kind:string,row:Row)=>({kind,id:row.id,version:row.version})
export function quotedDeclinedLine(quote:Row|undefined,proposal:any){
 const original=quote?.revisions.find((r:any)=>r.n===proposal.revision)?.lines.find((l:any)=>l.id===proposal.lineId)
 if(!original)return null
 // Price and quantity may be refreshed. Replacing the work itself does not
 // establish a new association merely because the quote has one line.
 const matches=quote!.revisions.at(-1).lines.filter((l:any)=>l.kind===original.kind&&l.description===original.description&&l.pierItemId===original.pierItemId)
 return matches.find((l:any)=>l.id===original.id)??(matches.length===1?matches[0]:null)
}
/** Observations are evidence for a person, never permission to contact or book. */
export function declinedReviewSources(s:State,item:Row,now:string){
 const asset=find(s,'asset',item.assetId),jobs=ordered(rows(s,'job').filter(j=>j.assetId===asset.id)),jobIds=new Set(jobs.map(j=>j.id))
 const account=rows(s,'customerAccount').find(a=>a.id===asset.customerAccountId),contacts=ordered(rows(s,'contact').filter(c=>account?.contactIds?.includes(c.id)))
 const kinds=['estimate','inspection','reading','serviceInterval']
 const related=kinds.flatMap(kind=>ordered(rows(s,kind).filter(r=>jobIds.has(r.jobId))).map(r=>({kind,row:r})))
 const calendar=['bookingService','calendarResource','calendarTechnician','calendarAbsence','calendarSeries','appointment'].flatMap(kind=>ordered(rows(s,kind)).map(r=>({kind,row:r})))
 const stops=ordered(rows(s,'outreach').filter(r=>r.kind==='declined'&&r.subjectId===item.id)).map(r=>({id:r.id,version:r.version,status:r.status}))
 const reservations=calendarReservations(s,now).filter(r=>r.endAt>now).map(r=>({id:r.id,source:r.source,startAt:r.startAt,endAt:r.endAt})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))
 const preferences=ordered(rows(s,'chaseOptOut').filter(r=>r.email===(asset.customerEmail??'').trim().toLowerCase())).map(row=>({kind:'chaseOptOut',row}))
 const all=[...preferences,{kind:'declinedWork',row:item},{kind:'asset',row:asset},...(account?[{kind:'customerAccount',row:account}]:[]),...contacts.map(row=>({kind:'contact',row})),...jobs.map(row=>({kind:'job',row})),...related,...calendar]
 // Hash actual contents as well as revisions. Retained snapshots are never authority.
 return {fingerprint:hash([now.slice(0,10),all,stops,reservations]),citations:all.map(({kind,row})=>citation(kind,row)),stops,reservations,asset,account,contacts,jobs}
}
export function declinedReviewSnapshot(s:State,item:Row,now:string,findingKey=''){
 const sources=declinedReviewSources(s,item,now),active=readings(s,item.assetId),reading=active.filter(r=>r.unit===item.unit).at(-1)??null
 const inspections=rows(s,'inspection').filter(i=>sources.jobs.some(j=>j.id===i.jobId)).flatMap(i=>i.template.snapshot.items.map((point:any)=>({inspectionId:i.id,version:i.version,jobId:i.jobId,templateId:i.template.id,itemId:point.id,label:point.label,result:[...i.results].reverse().find((r:any)=>r.itemId===point.id)??null})))
 const quotes=(item.proposals??[]).map((p:any)=>{const q=rows(s,'estimate').find(q=>q.id===p.estimateId),rev=q?.revisions.at(-1),line=quotedDeclinedLine(q,p),job=sources.jobs.find(j=>j.id===p.jobId);return {estimateId:q?.id??p.estimateId,version:q?.version??null,revision:rev?.n??null,line:line??null,jobId:p.jobId,status:q?.status??'unknown',decision:q?.authorisation??null,completed:!!line&&(job?.actuals??[]).filter((a:any)=>a.estimateId===q?.id&&a.lineId===line.id&&a.revision===rev.n).reduce((n:number,a:any)=>n+a.quantityMilli,0)>=Math.round(line.quantity*1000)}})
 const selected=inspections.find((i:any)=>i.inspectionId+':'+i.itemId===findingKey)
 if(findingKey&&!selected)fail('REVIEW_INSPECTION','Choose an inspection point from this vehicle.')
 // A later observation of the same checklist point supersedes the selected
 // finding, including when staff assigned a replacement checklist.
 const current=selected?inspections.filter(i=>i.templateId===selected.templateId&&i.itemId===selected.itemId&&i.result).sort((a,b)=>a.result.at.localeCompare(b.result.at)||find(s,'inspection',a.inspectionId).assignedAt.localeCompare(find(s,'inspection',b.inspectionId).assignedAt)).at(-1):null
 const suppressed=optedOut(s,sources.asset.customerEmail??'')?'Customer opted out of reminders':current?.result?.outcome==='green'?'Replacement inspection records this finding as green':sources.asset.privacyErasedAt?'Customer erased':item.inapplicable?'Finding no longer applies':quotes.some((q:any)=>q.completed)?'Work already completed':quotes.some((q:any)=>q.decision)?'A later customer decision requires human follow-through':sources.stops.some(r=>r.status==='stopped')?'A recorded follow-up stop requires human review':null
 return {fingerprint:hash([sources.fingerprint,findingKey]),findingKey,citations:sources.citations,asOfDay:now.slice(0,10),decision:{estimateId:item.estimateId,revision:item.revision,reason:item.reason,evidence:item.evidence,disposition:item.disposition,line:structuredClone(item.line),customer:structuredClone(item.decision)},reading:reading?structuredClone(reading):null,threshold:{distance:reading&&!reading.regression&&item.dueValue!==null?reading.value>=item.dueValue:null,time:item.dueDate?now.slice(0,10)>=item.dueDate:null,dueValue:item.dueValue,dueDate:item.dueDate,unit:item.unit},inspections,quotes,ownership:{assetId:item.assetId,assetVersion:sources.asset.version,accountId:sources.account?.id??null,accountVersion:sources.account?.version??null,contacts:sources.contacts.map(r=>citation('contact',r)),verified:false},capacity:{reservations:sources.reservations,configuredWindows:rows(s,'bookingService').filter(r=>r.active).reduce((n,r)=>n+(r.windows?.length??0),0),availability:'unknown'},eligibility:{licensedSchedule:'unknown',consent:'unknown',availability:'unknown'},suppressed}
}
export const declinedWorkReview:Handler=(c,command,p)=>{
 if(!declinedReviewCommands.includes(command))return
 if(!['owner','admin'].includes(c.actor.role))fail('FORBIDDEN','Only the owner or service advisor reviews declined work.',null,403)
 const item=find(c.s,'declinedWork',p.declinedWorkId),asset=find(c.s,'asset',item.assetId),job=find(c.s,'job',p.jobId)
 if(asset.privacyErasedAt)fail('REVIEW_ERASED','Erased customer content cannot be reviewed again.')
 if(job.assetId!==asset.id)fail('INPUT','Review this vehicle on its own visit.',null,400)
 const prior=rows(c.s,'declinedReview').find(r=>r.declinedWorkId===item.id)
 if(command==='declineReview.refresh'){
  expectVersion(item,p.itemVersion)
  if(prior)expectVersion(prior,p.version)
  else if(p.version!==0)fail('VERSION','A new review requires version zero.')
  const snapshot=declinedReviewSnapshot(c.s,item,c.now,typeof p.findingKey==='string'?p.findingKey:'')
  if(prior?.revisions.at(-1).fingerprint===snapshot.fingerprint)return prior
  const revision={...snapshot,n:(prior?.revisions.length??0)+1,by:who(c),at:c.now}
  const saved=prior?bump(c.s,'declinedReview',prior,{jobId:job.id,revisions:[...prior.revisions,revision]}):put(c.s,'declinedReview',{jobId:job.id,assetId:asset.id,declinedWorkId:item.id,revisions:[revision],offers:[]})
  event(c,command,job.id,saved.id,{revision:revision.n});return saved
 }
 if(!prior||prior.erasedAt)fail('REVIEW_REQUIRED','Refresh this review before preparing an advisory.')
 expectVersion(prior,p.version)
 const revision=prior.revisions.at(-1),snapshot=declinedReviewSnapshot(c.s,item,c.now,revision.findingKey)
 if(revision.fingerprint!==snapshot.fingerprint)fail('REVIEW_STALE','Sources changed. Refresh the packet before preparing an advisory.')
 if(snapshot.suppressed)fail('REVIEW_SUPPRESSED',snapshot.suppressed)
 const quote=snapshot.quotes.find((q:any)=>q.estimateId===p.estimateId)
 if(!quote?.line||!['draft','approved','sent'].includes(quote.status)||quote.decision)fail('REVIEW_QUOTE','Choose a current native repriced estimate awaiting a new customer decision.')
 if(prior.offers.some((o:any)=>o.revision===revision.n&&o.estimateId===quote.estimateId))return prior
 const offer={revision:revision.n,fingerprint:revision.fingerprint,estimateId:quote.estimateId,quoteVersion:quote.version,quoteRevision:quote.revision,line:structuredClone(quote.line),eligibility:structuredClone(snapshot.eligibility),status:'advisory-only',by:who(c),at:c.now}
 const saved=bump(c.s,'declinedReview',prior,{offers:[...prior.offers,offer]})
 event(c,command,job.id,saved.id,{revision:revision.n,estimateId:quote.estimateId});return saved
}
