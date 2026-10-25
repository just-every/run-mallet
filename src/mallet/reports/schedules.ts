import {createHash} from 'node:crypto'
import {operatorMail} from '../../mail.server.mjs'
import type {Bindings} from '../../auth.server'
import type {Actor,Authority} from '../auth'
import {execute,fail,load,rows} from '../model'
import {technicianReport,period} from './technicians'
import {turnaroundReport} from './turnaround'
import {technicianCsv,turnaroundCsv} from './csv'
export async function configureReportSchedule(env:Bindings,actor:Actor,authority:Authority,input:any){
 if(actor.role!=='owner')fail('FORBIDDEN','Only the current owner may schedule a report to their own native email.',null,403)
 const person=await env.DB.prepare("SELECT email,version FROM oa_operators WHERE id=? AND role='owner' AND status='active'").bind(actor.id).first<{email:string,version:number}>()
 if(!person)fail('FORBIDDEN','An active owner is required.',null,403)
 const result=await execute(env.DB,actor as any,'reportFilter.schedule',{...input,to:person.email,operatorVersion:person.version},authority)
 // Recording consent first is safe if activation fails: no mail can run without the local grant.
 if(result.schedule?.active)await env.DB.prepare(`INSERT INTO mallet_report_schedules(filter_id,owner_id,owner_version,email,due_at,every_days,consent_at) SELECT ?,?,?,?,?,?,? WHERE (${authority.sql}) ON CONFLICT(filter_id) DO UPDATE SET owner_id=excluded.owner_id,owner_version=excluded.owner_version,email=excluded.email,due_at=excluded.due_at,every_days=excluded.every_days,consent_at=excluded.consent_at`).bind(result.id,actor.id,person.version,person.email,result.schedule.nextAt,result.schedule.everyDays,result.schedule.at,...authority.params).run()
 else await env.DB.prepare('DELETE FROM mallet_report_schedules WHERE filter_id=? AND owner_id=?').bind(result.id,actor.id).run()
 return result
}
/** One durable claim per occurrence; an uncertain or failed handoff disables future authority. */
export async function runReportSchedules(env:Bindings,scheduledTime:number){
 const now=new Date(scheduledTime).toISOString(),mail=operatorMail(env);if(!mail)return
 const due=(await env.DB.prepare(`SELECT r.* FROM mallet_report_schedules r JOIN oa_operators o ON o.id=r.owner_id JOIN mallet_records f ON f.kind='reportFilter' AND f.id=r.filter_id WHERE r.due_at<=? AND o.status='active' AND o.role='owner' AND o.version=r.owner_version AND o.email=r.email AND json_extract(f.value,'$.archived')=0 AND json_extract(f.value,'$.ownerId')=r.owner_id ORDER BY r.due_at LIMIT 20`).bind(now).all<any>()).results
 for(const schedule of due){
  const sql="EXISTS(SELECT 1 FROM mallet_report_schedules r JOIN oa_operators o ON o.id=r.owner_id WHERE r.filter_id=? AND r.due_at=? AND r.consent_at=? AND o.status='active' AND o.role='owner' AND o.version=r.owner_version AND o.email=r.email)",params=[schedule.filter_id,schedule.due_at,schedule.consent_at]
  if(!await env.DB.prepare('SELECT 1 AS ok WHERE '+sql).bind(...params).first())continue
  const s=await load(env.DB),filter=rows(s,'reportFilter').find(r=>r.id===schedule.filter_id)
  if(!filter||filter.archived||filter.ownerId!==schedule.owner_id)continue
  const actor={id:schedule.owner_id,name:filter.by.name,role:'owner'} as Actor,p=period(filter.from,filter.to,now)
  const content=filter.report==='technicians'?technicianCsv(technicianReport(s,actor,p,now)):turnaroundCsv(turnaroundReport(s,p,now))
  let claim:any
  try{claim=await execute(env.DB,{id:'report-scheduler',name:'Report scheduler',role:'system'},'reportDelivery.claim',{filterId:filter.id,dueAt:schedule.due_at,to:schedule.email,contentHash:createHash('sha256').update(content).digest('hex'),consentAt:schedule.consent_at},{sql,params},now)}catch{continue}
  // Advance beyond this invocation rather than replaying missed deliveries in a burst.
  const nextAt=new Date(scheduledTime+schedule.every_days*86400000).toISOString()
  await env.DB.prepare('UPDATE mallet_report_schedules SET due_at=? WHERE filter_id=? AND due_at=?').bind(nextAt,filter.id,schedule.due_at).run()
  const allowed=await env.DB.prepare("SELECT 1 AS ok FROM mallet_report_schedules r JOIN oa_operators o ON o.id=r.owner_id WHERE r.filter_id=? AND r.consent_at=? AND o.status='active' AND o.role='owner' AND o.version=r.owner_version AND o.email=r.email").bind(filter.id,schedule.consent_at).first()
  let outcome:any={status:'failed',provider:'permission-revoked'}
  if(allowed)try{outcome=await mail.send({deliveryId:claim.id,from:String(env.MAIL_FROM??''),to:[schedule.email],subject:'Scheduled report: '+filter.name,html:'<p>Your consented native report is attached. Handed to the mail provider does not mean delivered.</p>',text:'Your consented native report for '+filter.from+' through '+filter.to+'. CSV attached. Mail provider handoff does not confirm delivery.',attachments:[{filename:'mallet-'+filter.report+'.csv',contentType:'text/csv',content:new TextEncoder().encode(content)}],headers:{}})}catch{outcome={status:'uncertain',provider:'mail'}}
  const status=['accepted','development'].includes(outcome.status)?outcome.status:outcome.status==='uncertain'?'uncertain':'failed'
  await execute(env.DB,{id:'report-scheduler',name:'Report scheduler',role:'system'},'reportDelivery.outcome',{deliveryId:claim.id,status,provider:outcome.provider??'mail'},undefined,now)
  if(!['accepted','development'].includes(status))await env.DB.prepare('DELETE FROM mallet_report_schedules WHERE filter_id=? AND consent_at=?').bind(filter.id,schedule.consent_at).run()
 }
}

export async function reportFilterView(env:Bindings,actor:Actor,filters:any[]){
 const active=(await env.DB.prepare("SELECT r.filter_id FROM mallet_report_schedules r JOIN oa_operators o ON o.id=r.owner_id WHERE r.owner_id=? AND o.version=r.owner_version AND o.status='active' AND o.role='owner' AND o.email=r.email").bind(actor.id).all<{filter_id:string}>()).results
 const s=await load(env.DB)
 return filters.map(f=>({...f,localScheduleActive:active.some(r=>r.filter_id===f.id),deliveries:rows(s,'reportDelivery').filter(d=>d.filterId===f.id&&d.ownerId===actor.id).map(d=>({dueAt:d.dueAt,status:d.status}))}))
}
