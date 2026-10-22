import {onCrew} from './collaboration'
import {bump,event,expectVersion,fail,find,integer,put,rows,text,who,type Handler,type Row} from './model'
import {openJob} from './workshop'
export const diagnosisCommands=['diagnosis.record','diagnosis.share','diagnosisLink.create','diagnosisLink.revoke'] as const
export const diagnosisMemberCommands=['diagnosis.record'] as const
export const LINK_DAYS={min:1,max:30,default:7}
const DTC=/^[PBCU][0-3][0-9A-F]{3}$/
const optional=(v:unknown,label:string,max:number)=>text(v,label,max,true)
function list(value:unknown,label:string,max:number):any[] {
 if(value===undefined||value===null)return []
 if(!Array.isArray(value)||value.length>max)fail('INPUT',`${label} must be a list of at most ${max}.`,null,400)
 return value
}
function content(p:any) {
 const dtcs=list(p.dtcs,'Trouble codes',50).map(d=>{const code=text(d?.code,'trouble code',5);if(!DTC.test(code))fail('INPUT','Trouble codes are exact uppercase OBD-II codes such as P0301.',null,400);return {code,description:optional(d.description,'trouble code description',200)}})
 const measurements=list(p.measurements,'Measurements',50).map(m=>{if(typeof m?.value!=='number'||!Number.isFinite(m.value)||Math.abs(m.value)>1e12)fail('INPUT','Each measurement needs a finite value.',null,400);return {name:text(m.name,'measurement name',100),value:m.value,unit:text(m.unit,'measurement unit',30)}})
 return {complaint:text(p.complaint,'complaint',2000),cause:optional(p.cause,'cause',2000),correction:optional(p.correction,'correction',2000),dtcs,measurements,testMethod:optional(p.testMethod,'test method',2000),attachments:list(p.attachments,'Attachments',10),staffNote:optional(p.staffNote,'staff-only note',4000),customerExplanation:optional(p.customerExplanation,'customer explanation',4000)}
}
const manager=(role:string)=>['owner','admin'].includes(role)
// Diagnostic records append revisions; sharing names one exact revision and only an owner or advisor may share.
export const diagnostics:Handler=(c,command,p)=>{
 if(!(diagnosisCommands as readonly string[]).includes(command))return
 if(c.actor.role==='agent')fail('FORBIDDEN','Diagnostics require a native staff session.',null,403)
 if(command==='diagnosis.record') {
  const job=openJob(c,p)
  if(!manager(c.actor.role)&&!onCrew(job,c.actor.id))fail('FORBIDDEN','Only this repair’s assigned technician, the owner or a service advisor may record diagnostics.',null,403)
  const value=content(p)
  if(value.attachments.some((a:any)=>a?.jobId!==job.id))fail('INPUT','Attach only completed media from this repair.',null,400)
  if(p.diagnosisId===undefined||p.diagnosisId===null||p.diagnosisId==='') {
   const row=put(c.s,'diagnosis',{jobId:job.id,shared:null,revisions:[{n:1,...value,by:who(c),at:c.now}]});event(c,command,job.id,row.id,{revision:1});return row
  }
  const row=find(c.s,'diagnosis',p.diagnosisId);expectVersion(row,p.diagnosisVersion)
  if(row.jobId!==job.id)fail('NOT_FOUND','That diagnosis does not belong to this repair.',null,404)
  const n=row.revisions.length+1,next=bump(c.s,'diagnosis',row,{revisions:[...row.revisions,{n,...value,by:who(c),at:c.now}]});event(c,command,job.id,row.id,{revision:n});return next
 }
 if(!manager(c.actor.role))fail('FORBIDDEN','An owner or service advisor must review customer sharing.',null,403)
 if(command==='diagnosis.share') {
  const row=find(c.s,'diagnosis',p.diagnosisId);expectVersion(row,p.version)
  const shared=p.share===true?{revision:integer(p.revision,'revision',1,row.revisions.length),by:who(c),at:c.now}:null
  if(p.share!==true&&p.share!==false)fail('INPUT','Choose whether to share this diagnosis.',null,400)
  const next=bump(c.s,'diagnosis',row,{shared,shareHistory:[...(row.shareHistory??[]),{revision:shared?.revision??null,by:who(c),at:c.now}]});event(c,command,row.jobId,row.id,{revision:shared?.revision??null});return next
 }
 if(command==='diagnosisLink.create') {
  const job=find(c.s,'job',p.jobId),days=integer(p.days??LINK_DAYS.default,'link lifetime in days',LINK_DAYS.min,LINK_DAYS.max)
  if(p.reportId){const report=find(c.s,'inspectionReport',p.reportId);if(report.jobId!==job.id)fail('REPORT_SCOPE','This report belongs to another repair.',null,400)}
  const row=put(c.s,'diagnosisLink',{jobId:job.id,...(p.reportId?{reportId:p.reportId}:{}),createdBy:who(c),createdAt:c.now,expiresAt:new Date(Date.parse(c.now)+days*86_400_000).toISOString(),revokedAt:null,revokedBy:null,sentByMallet:false});event(c,command,job.id,row.id,{expiresAt:row.expiresAt});return row
 }
 const link=find(c.s,'diagnosisLink',p.linkId);expectVersion(link,p.version)
 if(link.revokedAt)fail('LINK_STATE','This link is already revoked.')
 const next=bump(c.s,'diagnosisLink',link,{revokedAt:c.now,revokedBy:who(c)});event(c,command,link.jobId,link.id,{});return next
}
export const sharedDiagnoses=(s:any,jobId:string)=>rows(s,'diagnosis').filter((d:Row)=>d.jobId===jobId&&d.shared).map((d:Row)=>({id:d.id,...d.revisions.find((r:any)=>r.n===d.shared.revision)}))
export const linkActive=(link:Row,now:string)=>!link.revokedAt&&link.expiresAt>now
