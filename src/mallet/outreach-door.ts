import {execute,rows,load,fail} from './model'
import {digest,type Actor,type Authority} from './auth'
import {runtimeBindings,type Bindings} from '../auth.server'
import {operatorMail} from '../mail.server.mjs'
import {outreachDue,outreachStop} from './outreach'
import {shopTime} from './promise-zone'
import {e} from './ui/common'
const scheduler={id:'mallet-scheduler',name:'Scheduled reminders',role:'system' as const}
export async function outreachCommand(env:Bindings,actor:Actor,authority:Authority,command:string,input:any){
 let checked=authority
 if(command==='outreach.availability'||command==='outreach.schedule'&&input.kind==='declined'){
  const state=await load(env.DB),quote=rows(state,'estimate').find(q=>q.id===input.estimateId),job=rows(state,'job').find(j=>j.id===quote?.jobId)
  const native=await env.DB.prepare("SELECT id,version FROM oa_operators WHERE id=? AND status='active' AND role IN ('owner','admin','member')").bind(job?.technicianId??'').first<{id:string,version:number}>()
  if(!native)fail('OUTREACH_AVAILABILITY','Current native staff capacity is missing or revoked.')
  if(command==='outreach.schedule'){
   const review=rows(state,'declinedAvailability').find(r=>r.id===input.availabilityId)
   if(review?.nativeTechnician?.id!==native.id||review?.nativeTechnician?.version!==native.version)fail('OUTREACH_AVAILABILITY','Native staff changed after the availability review.')
  }
  input={...input,nativeTechnician:native}
  checked={sql:'('+authority.sql+") AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND version=? AND status='active')",params:[...authority.params,native.id,native.version]}
 }
 let withdrawalToken=''
 if(command==='outreach.schedule'&&input.kind==='declined'){
  withdrawalToken=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')
  input={...input,withdrawUrl:env.AUTH_ORIGIN+'/declined-email/'+withdrawalToken,bookingUrl:env.AUTH_ORIGIN+'/book?declined='+withdrawalToken}
 }
 const row=await execute(env.DB,actor as any,command,input,checked)
 if(withdrawalToken)await env.DB.prepare('INSERT INTO mallet_declined_withdrawal_tokens(token_hash,consent_id,outreach_id) VALUES(?,?,?)').bind(await digest(withdrawalToken),row.consentId,row.id).run()
 if(command==='outreach.schedule'){
  // A crash here leaves an inert business record, never an authorized send.
  await env.DB.prepare(`INSERT INTO mallet_outreach_authority SELECT ?,id,version FROM oa_operators WHERE id=? AND role='owner' AND status='active' AND (${authority.sql})`).bind(row.id,actor.id,...authority.params).run()
 }
 return row
}
async function authorized(env:Bindings,row:any){
 if(row.kind==='declined'){const native=row.availabilitySnapshot?.nativeTechnician;if(!native||!await env.DB.prepare("SELECT id FROM oa_operators WHERE id=? AND version=? AND status='active' AND role IN ('owner','admin','member')").bind(native.id,native.version).first())return false}
 return !!await env.DB.prepare("SELECT a.outreach_id FROM mallet_outreach_authority a JOIN oa_operators o ON o.id=a.owner_id WHERE a.outreach_id=? AND o.version=a.owner_version AND o.role='owner' AND o.status='active'").bind(row.id).first()
}
/** Bounded cron work; a persisted claim can never initiate a second send. */
export async function runOutreach(original:Bindings,at:number){
 const env=runtimeBindings(original),now=new Date(at).toISOString(),actualNow=new Date(Math.max(at,Date.now())).toISOString(),snapshot=await load(env.DB)
 const executionTime=(r:any)=>r.kind==='declined'?actualNow:now
 for(const candidate of rows(snapshot,'outreach').filter(r=>r.status==='claimed'||r.status==='pending'&&(outreachStop(snapshot,r,executionTime(r))||outreachDue(snapshot,r,executionTime(r)))).sort((a,b)=>a.dueAt.localeCompare(b.dueAt)||a.id.localeCompare(b.id)).slice(0,100)){
  let r=candidate
  const currentTime=executionTime(r)
  if(r.status==='claimed'){
   if(Date.parse(r.claimedAt)+60000<=Date.parse(currentTime))try{await execute(env.DB,scheduler,'outreach.outcome',{id:r.id,version:r.version,status:'uncertain',provider:'interrupted'},undefined,currentTime)}catch{}
   continue
  }
  const stop=outreachStop(snapshot,r,currentTime)
  if(!stop&&!outreachDue(snapshot,r,currentTime))continue
  try{r=await execute(env.DB,scheduler,'outreach.claim',{id:r.id,version:r.version},undefined,currentTime)}catch{continue}
  if(r.status!=='claimed')continue
  let status='skipped',provider='none',providerReference='',reason=''
  try{
   const current=await load(env.DB),handoffNow=new Date(Math.max(at,Date.now())).toISOString()
   const live=rows(current,'outreach').find(x=>x.id===r.id)!,hasAuthority=await authorized(env,r)
   reason=!hasAuthority?'Current owner or native technician authority unavailable':outreachStop(current,live,handoffNow)
   if(!reason&&outreachDue(current,r,handoffNow)){
    let content=r.instructions
    if(r.kind==='appointment'){
     const a=rows(current,'appointment').find(a=>a.id===r.subjectId)!
     // Revoked or restored management authority never grows a new link.
     if(!await env.DB.prepare('SELECT appointment_id FROM mallet_booking_tokens WHERE appointment_id=? AND revoked_at IS NULL').bind(a.id).first())throw Error('Management authority unavailable')
     const secret=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')
     await env.DB.prepare('INSERT INTO mallet_booking_reminder_tokens(appointment_id,token_hash) VALUES(?,?)').bind(a.id,await digest(secret)).run()
     content=`${a.service.name}\n${a.service.location}\n${shopTime(a.startAt,a.service.timeZone)}\n${r.instructions}\nReschedule or cancel: ${env.AUTH_ORIGIN}/book/${secret}\nNo repair work or payment is authorized.`
    }else content=r.content
    const mail=operatorMail(env)
    if(mail){
     const result=await mail.send({deliveryId:r.id,from:String(env.MAIL_FROM??''),to:[r.to],subject:r.kind==='appointment'?'Your appointment reminder':r.kind==='balance'?'Your invoice balance reminder':'Your declined-work follow-up',text:content,html:'<p>'+e(content).replaceAll('\n','<br>')+'</p>',headers:{}})
     status=['rejected','rate_limited','unavailable'].includes(result.status)?'failed':result.status;provider=result.provider??'mail';providerReference=result.providerMessageId??''
    }else{status='failed';provider='unavailable'}
   }else if(!reason)reason='Recipient allowed hours or eligibility no longer permit handoff'
  }catch{status='uncertain';provider='mail'}
  try{await execute(env.DB,scheduler,'outreach.outcome',{id:r.id,version:r.version,status,provider,providerReference,reason},undefined,r.kind==='declined'?new Date(Math.max(at,Date.now())).toISOString():now)}catch{}
 }
}
