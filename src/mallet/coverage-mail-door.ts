import {runtimeBindings,type Bindings} from '../auth.server'
import {operatorMail} from '../mail.server.mjs'
import {digest} from './auth'
import {execute,find,load,rows,type Row} from './model'
import {coverageMailStop} from './coverage-mail'
import {allowedHour} from './outreach'
import {e} from './ui/common'
const scheduler={id:'mallet-coverage-mail',name:'Coverage email scheduler',role:'system' as const}
const authoritySql="EXISTS(SELECT 1 FROM mallet_coverage_mail_authority a JOIN oa_operators o ON o.id=a.owner_id WHERE a.notice_id=? AND o.version=a.owner_version AND o.role='owner' AND o.status='active')"
export const coverageMailAuthority=(env:Bindings,id:string)=>env.DB.prepare('SELECT 1 AS ok WHERE '+authoritySql).bind(id).first()
export async function runCoverageMail(original:Bindings,at:number){
 const env=runtimeBindings(original),now=new Date(at).toISOString(),snapshot=await load(env.DB)
 for(const n of rows(snapshot,'coverageNotice').filter(n=>['pending','claimed'].includes(n.status)).sort((a,b)=>a.dueAt.localeCompare(b.dueAt)||a.id.localeCompare(b.id)).slice(0,100)){
  if(n.status==='claimed'){
   if(Date.parse(n.claimedAt)+60000<=at)try{await execute(env.DB,scheduler,'coverage.mailOutcome',{id:n.id,version:n.version,status:'uncertain',provider:'interrupted'},undefined,now)}catch{}
   continue
  }
  const authorized=await coverageMailAuthority(env,n.id),stop=coverageMailStop(snapshot,n,now)
  if(authorized&&!stop&&(n.dueAt>now||!allowedHour(now,n.timeZone,n.allowedStart,n.allowedEnd)))continue
  let row:Row
  try{row=await execute(env.DB,scheduler,'coverage.mailClaim',{id:n.id,version:n.version},undefined,now)}catch{continue}
  if(row.status!=='claimed')continue
  let status='stopped',provider='none',providerReference=''
  try{
   const current=await load(env.DB),handoffNow=new Date(Math.max(at,Date.now())).toISOString()
   row=find(current,'coverageNotice',n.id)
   if(await coverageMailAuthority(env,n.id)&&!coverageMailStop(current,row,handoffNow)&&allowedHour(handoffNow,row.timeZone,row.allowedStart,row.allowedEnd)){
    const token=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')
    await env.DB.batch([
     env.DB.prepare('INSERT INTO mallet_assert(ok) SELECT CASE WHEN '+authoritySql+' THEN 1 ELSE 0 END').bind(row.id),
     env.DB.prepare('INSERT INTO mallet_coverage_reply_tokens(notice_id,token_hash,job_id) VALUES(?,?,?)').bind(row.id,await digest(token),row.jobId),
     env.DB.prepare('DELETE FROM mallet_assert')
    ])
    const text=row.content.replace('[private coverage link]',`${env.AUTH_ORIGIN}/coverage-response/${token}`),mail=operatorMail(env)
    if(!mail){status='failed';provider='unavailable'}
    else{
     const result=await mail.send({deliveryId:row.id,from:String(env.MAIL_FROM??''),to:[row.to],subject:'Your coverage review',text,html:'<p>'+e(text).replaceAll('\n','<br>')+'</p>',headers:{}})
     status=['rejected','rate_limited','unavailable'].includes(result.status)?'failed':result.status
     if(!['accepted','development','failed','uncertain'].includes(status))status='uncertain'
     provider=result.provider??'mail';providerReference=result.providerMessageId??''
    }
   }
  }catch{status='uncertain';provider='mail'}
  try{const latest=find(await load(env.DB),'coverageNotice',n.id);await execute(env.DB,scheduler,'coverage.mailOutcome',{id:n.id,version:latest.version,status,provider,providerReference},undefined,now)}catch{}
 }
}
