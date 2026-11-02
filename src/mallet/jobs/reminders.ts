import {runStatusNotices} from '../status-notice-door'
import {runOutreach} from '../outreach-door'
import {runtimeBindings,type Bindings} from '../../auth.server'
import {operatorMail} from '../../mail.server.mjs'
import {digest} from '../auth'
import {execute,load,rows} from '../model'
import {linkState} from '../approval-links'
import {optedOut} from '../approval-chasing'
import {enqueueReminder} from './store'
import {runDueJobs} from './runner'
import {dispatchPaymentCheck} from './provider-check'
import type {Outcome,ReminderJob,ReminderPayload} from './types'
const SCHEDULER={id:'mallet-scheduler',name:'Scheduled reminders',role:'system'} as any
const skipped=():Outcome=>({status:'skipped',provider:'none',providerMessageId:null})
const token=()=>btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')
const STOP_NOTE='To stop reminders about estimates, open the link and choose Stop reminders.'

/** Recheck the current revision, consent and repair immediately before the one provider handoff. */
async function deliverReminder(env:Bindings,job:ReminderJob,now:string):Promise<Outcome>{
 const p=job.payload as ReminderPayload,s=await load(env.DB),chase=rows(s,'approvalChase').find(c=>c.id===p.chaseId),step=chase?.steps.find((x:any)=>x.n===p.step),link=rows(s,'approvalLink').find(l=>l.id===p.linkId)
 if(!chase||!step||step.status!=='claimed'||chase.stoppedAt||!link||linkState(s,link,now)!=='active'||optedOut(s,link.to))return skipped()
 // A restored business snapshot cannot recreate the excluded scoped-link authority.
 if(!await env.DB.prepare('SELECT id FROM mallet_approval_links WHERE id=?').bind(link.id).first())return skipped()
 const mail=operatorMail(env);if(!mail)return {status:'unavailable',provider:'none',providerMessageId:null}
 const secret=token(),url=env.AUTH_ORIGIN+'/approve/'+secret,repair=rows(s,'job').find(j=>j.id===p.jobId)
 // Keep authority tokens outside the durable job and every archive.
 await env.DB.prepare('INSERT INTO mallet_approval_reminder_tokens(token_hash,link_id,created_at) VALUES(?,?,?)').bind(await digest(secret),link.id,now).run()
 try{
  const result=await mail.send({deliveryId:`${p.chaseId}:${p.step}`,from:String(env.MAIL_FROM??''),to:[link.to],subject:`Reminder: your repair estimate is waiting: ${repair?.title??'repair'}`,text:`Your repair shop is still waiting for your decision on this estimate.\n\n${url}\n\nThis link expires ${link.expiresAt} (UTC). ${STOP_NOTE}`,html:`<p>Your repair shop is still waiting for your decision on this estimate.</p><p><a href="${url}">Review the estimate</a></p><p>This link expires ${link.expiresAt} (UTC). ${STOP_NOTE}</p>`,headers:{}})
  return {status:result.status as Outcome['status'],provider:result.provider,providerMessageId:result.providerMessageId??null}
 }catch{return {status:'uncertain',provider:String(env.MAIL_PROVIDER??'mail'),providerMessageId:null}}
}

/** Persist the provider outcome before projecting it to the repair. A crash can repeat this projection, never the send. */
async function projectOutcomes(env:Bindings,now:string){
 const terminal=(await env.DB.prepare("SELECT id,payload,outcome FROM mallet_jobs WHERE kind='approval-reminder' AND status IN ('succeeded','failed','uncertain','resolved') AND outcome IS NOT NULL AND projected_at IS NULL ORDER BY updated_at,id LIMIT 100").all<{id:string;payload:string;outcome:string}>()).results
 for(const row of terminal){
  const p=JSON.parse(row.payload),outcome=JSON.parse(row.outcome);if(outcome.status==='skipped'){await env.DB.prepare('UPDATE mallet_jobs SET projected_at=? WHERE id=?').bind(Date.parse(now),row.id).run();continue}
  const s=await load(env.DB),chase=rows(s,'approvalChase').find(c=>c.id===p.chaseId),step=chase?.steps.find((x:any)=>x.n===p.step)
  if(step?.status!=='claimed'){await env.DB.prepare('UPDATE mallet_jobs SET projected_at=? WHERE id=?').bind(Date.parse(now),row.id).run();continue}
  await execute(env.DB,SCHEDULER,'approvalChase.outcome',{chaseId:p.chaseId,step:p.step,...outcome},undefined,now)
  await env.DB.prepare('UPDATE mallet_jobs SET projected_at=? WHERE id=?').bind(Date.parse(now),row.id).run()
 }
}

/** Shared bounded worker. Pending reminder intents precede domain claims, closing the claim/enqueue crash window. */
export async function runReminderJobs(original:Bindings,at:number){
 const env=runtimeBindings(original),now=new Date(at).toISOString(),s=await load(env.DB)
 for(const chase of rows(s,'approvalChase'))for(const step of chase.steps){
  const payload={chaseId:chase.id,step:step.n,linkId:chase.linkId,jobId:chase.jobId}
  if(step.status==='pending'&&!chase.stoppedAt)await enqueueReminder(env.DB,payload,Date.parse(step.dueAt),at)
  else if(step.status==='claimed'){
   // Pre-upgrade claims have no durable dispatch evidence. Quarantine rather than guessing whether they sent.
   await env.DB.prepare("INSERT OR IGNORE INTO mallet_jobs(id,event_key,kind,payload,due_at,status,outcome,created_at,updated_at) VALUES(?,?,'approval-reminder',?,?,'uncertain',?,?,?)").bind(crypto.randomUUID(),`approval-reminder:${chase.id}:${step.n}`,JSON.stringify(payload),Date.parse(step.dueAt),JSON.stringify({status:'uncertain',provider:'unknown',providerMessageId:null}),at,at).run()
  }
 }
 await projectOutcomes(env,now)
 await execute(env.DB,SCHEDULER,'approvalChase.sweep',{},undefined,now)
 let handled=0;const started=Date.now()
 // At most four jobs run at once, with a bounded number of batches and a bounded sweep lifetime.
 for(let batch=0;batch<25&&Date.now()-started<45_000;batch++){
  const result=await runDueJobs(env.DB,job=>job.kind==='stripe-payment-check'?dispatchPaymentCheck(env,job):deliverReminder(env,job,now),at)
  if(!result.length)break
  handled+=result.filter(Boolean).length
 }
 await projectOutcomes(env,now)
 await runOutreach(env,at)
 await runStatusNotices(env,at)
 return handled
}
