// PART-006: supplier evidence is transcribed by staff; arrival is a separate immutable receiving decision.
import {bump,event,expectVersion,fail,find,put,rows,text,who,type Context,type Handler,type Row} from './model'
import {price} from './money'
import {instant,openJob} from './workshop'
import {authorizedCap,estimateForWork} from './supplement-scope'
import {currentPromisePlan,savePlan} from './promises'
export const specialPartCommands=['specialPart.record','specialPart.delay','specialPart.receive','specialPart.review'] as const
const evidence=(c:Context,p:any,n:number)=>({n,eta:instant(p.eta,'supplier ETA'),acknowledgment:text(p.acknowledgment,'supplier acknowledgment evidence',4000),reason:text(p.reason,'reason',2000),by:who(c),at:c.now})
function synchronize(c:Context,job:Row,part:Row,kind:string){
 const revision=part.revisions.at(-1),plan=currentPromisePlan(c.s,job.id),prior=plan?.revisions.at(-1),parts=structuredClone(prior?.parts??[])
 const item={partId:'special:'+part.id,specialPartId:part.id,name:part.charge.description,eta:revision.eta,source:'staff-recorded supplier acknowledgment; not provider-verified',sourceNote:`${part.supplier} · ${part.orderReference} · ${revision.acknowledgment}`,receivedAt:part.receipt?.receivedAt??null,reportedBy:who(c),at:c.now},index=parts.findIndex((p:any)=>p.partId===item.partId)
 if(index<0)parts.push(item);else parts[index]=item
 savePlan(c,job,plan,parts,structuredClone(prior?.dependencies??[]),revision.reason+(kind==='received'?'; physical receipt '+part.receipt.reference:''))
 put(c.s,'specialPartNotice',{jobId:job.id,specialPartId:part.id,revision:revision.n,kind,at:c.now,by:who(c),review:null})
 event(c,'specialPart.'+kind,job.id,part.id,{revision:revision.n,eta:revision.eta,receipt:part.receipt})
 return part
}
export const specialParts:Handler=(c,command,p)=>{
 if(!(specialPartCommands as readonly string[]).includes(command))return
 if(!['owner','admin'].includes(c.actor.role))fail('FORBIDDEN','The owner or a service advisor records special parts and receiving evidence.',null,403)
 if(command==='specialPart.review'){
  const notice=find(c.s,'specialPartNotice',p.noticeId);expectVersion(notice,p.version)
  if(notice.review)fail('ALREADY_REVIEWED','This notice has already been reviewed.')
  const saved=bump(c.s,'specialPartNotice',notice,{review:{reason:text(p.reason,'review note',2000),by:who(c),at:c.now}})
  event(c,command,notice.jobId,notice.id,{review:saved.review});return saved
 }
 const job=openJob(c,p)
 if(command==='specialPart.record'){
  const {estimate,rev}=estimateForWork(c.s,job,p),line=rev.lines.find((l:any)=>l.id===p.lineId)
  if(!line||line.kind!=='part'||!estimate.authorisation.lineIds.includes(line.id))fail('NOT_AUTHORISED','Choose a customer-authorized part on this repair.')
  const used=job.actuals.filter((a:any)=>a.estimateId===estimate.id&&a.revision===rev.n&&a.lineId===line.id).reduce((n:number,a:any)=>n+a.quantityMilli,0),remaining=authorizedCap(c.s,estimate,line)-used
  if(remaining<=0)fail('NO_REMAINING_PART','This authorized part has already been consumed or replaced.')
  if(rows(c.s,'specialPart').some(r=>r.estimateId===estimate.id&&r.revision===rev.n&&r.lineId===line.id))fail('DUPLICATE_SPECIAL_PART','This approved part already has a special-order record. Update that record instead.')
  const part=put(c.s,'specialPart',{jobId:job.id,estimateId:estimate.id,revision:rev.n,lineId:line.id,charge:{description:line.description,quantityMilli:remaining,quantity:remaining/1000,unitCents:line.unitCents,taxable:line.taxable,taxRateMillionths:line.taxRateMillionths,...price({...line,quantityMilli:remaining})},supplier:text(p.supplier,'supplier',200),orderReference:text(p.orderReference,'supplier order reference',200),revisions:[evidence(c,p,1)],receipt:null})
  return synchronize(c,job,part,'backorder')
 }
 const part=find(c.s,'specialPart',p.specialPartId);expectVersion(part,p.partVersion)
 if(part.jobId!==job.id)fail('PART_SCOPE','Use the special part on this repair.')
 if(part.receipt)fail('PART_RECEIVED','Physical receipt is already retained. It cannot be silently reopened or received twice.')
 if(command==='specialPart.delay'){
  const revision=evidence(c,p,part.revisions.length+1)
  if(revision.eta===part.revisions.at(-1).eta)fail('ETA_UNCHANGED','The supplier ETA has not changed.')
  return synchronize(c,job,bump(c.s,'specialPart',part,{revisions:[...part.revisions,revision]}),'delay')
 }
 const receivedAt=instant(p.receivedAt,'physical receipt time')
 if(receivedAt>c.now)fail('INPUT','Physical receipt cannot be recorded in the future.',null,400)
 const receipt={receivedAt,reference:text(p.receiptReference,'receiving reference',2000),quantityMilli:part.charge.quantityMilli,by:who(c),at:c.now}
 return synchronize(c,job,bump(c.s,'specialPart',part,{receipt}),'received')
}
