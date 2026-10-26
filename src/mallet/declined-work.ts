import {bump,event,expectVersion,fail,find,integer,put,rows,text,who,choice,type Handler} from './model'
import {current,estimates} from './estimates'
import {readings} from './mileage'

export const declinedWork:Handler=(c,command,p)=>{
 if(command==='decline.record') {
  const estimate=find(c.s,'estimate',p.estimateId);expectVersion(estimate,p.version)
  const rev=current(estimate),auth=estimate.authorisation,line=rev.lines.find((l:any)=>l.id===p.lineId)
  if(!auth||auth.revision!==rev.n||!line||auth.lineIds.includes(line.id))fail('NOT_DECLINED','Choose a declined line from the exact customer decision.')
  if(rows(c.s,'declinedWork').some(r=>r.estimateId===estimate.id&&r.revision===rev.n&&r.line.id===line.id))fail('DUPLICATE','That declined line is already in the register.')
  const job=find(c.s,'job',estimate.jobId),reading=find(c.s,'reading',p.readingId)
  if(reading.jobId!==job.id||!readings(c.s,job.assetId).some(r=>r.id===reading.id))fail('INPUT','Choose an active observed reading from this visit.',null,400)
  const dueDate=text(p.dueDate,'due date',10,true),dueValue=p.dueValue==null||p.dueValue===''?null:integer(p.dueValue,'due reading',0,100_000_000)
  if(dueDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)||!Number.isFinite(Date.parse(dueDate))||new Date(dueDate).toISOString().slice(0,10)!==dueDate))fail('INPUT','Use a valid due date.',null,400)
  if(!dueDate&&dueValue===null)fail('INPUT','Set a follow-up reading or date.',null,400)
  const row=put(c.s,'declinedWork',{assetId:job.assetId,jobId:job.id,estimateId:estimate.id,revision:rev.n,line:structuredClone(line),decision:structuredClone(auth),disposition:choice(p.disposition??'declined',['declined','deferred'],'disposition'),reason:text(p.reason,'reason',2000),evidence:text(p.evidence,'evidence',4000),reading:structuredClone(reading),owner:who(c),at:c.now,dueDate,dueValue,unit:reading.unit,proposals:[]})
  event(c,command,job.id,row.id,{line:row.line,reason:row.reason,dueDate,dueValue,unit:reading.unit});return row
 }
 if(command==='decline.inapplicable'){
  if(c.actor.role!=='owner')fail('FORBIDDEN','Only the owner records that a finding no longer applies.',null,403)
  const item=find(c.s,'declinedWork',p.declinedWorkId);expectVersion(item,p.version)
  if(item.inapplicable)fail('DECLINE_STOP','This finding is already stopped.')
  const evidence=text(p.evidence,'current finding review evidence',2000)
  const row=bump(c.s,'declinedWork',item,{inapplicable:{by:who(c),at:c.now,evidence}})
  event(c,command,item.jobId,item.id,{evidence});return row
 }
 if(command==='decline.reprice') {
  const item=find(c.s,'declinedWork',p.declinedWorkId);expectVersion(item,p.itemVersion)
  const job=find(c.s,'job',p.jobId)
  if(job.assetId!==item.assetId||job.id===item.jobId)fail('INPUT','Reprice on a later visit for this same vehicle.',null,400)
  const reason=text(p.reason,'current need review',2000),unitCents=integer(p.unitCents,'new unit price'),quantity=p.quantity??item.line.quantity
  const quote=estimates(c,'estimate.prepare',{jobId:job.id,version:p.version,notes:`Repriced declined work: ${reason}`,lines:[{kind:item.line.kind,description:item.line.description,quantity,unitCents,...(item.line.kind==='fee'?{feeTaxable:item.line.taxable}:{}),pierItemId:item.line.pierItemId}]})
  const row=bump(c.s,'declinedWork',item,{proposals:[...item.proposals,{jobId:job.id,estimateId:quote.id,revision:1,lineId:quote.revisions[0].lines[0].id,by:who(c),at:c.now,reason}]})
  event(c,command,job.id,row.id,{originalEstimateId:item.estimateId,originalRevision:item.revision,newEstimateId:quote.id,reason})
  return {jobId:job.id,item:row,estimate:quote}
 }
}
