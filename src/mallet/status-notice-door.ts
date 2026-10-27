import {runtimeBindings,type Bindings} from '../auth.server'
import {operatorMail} from '../mail.server.mjs'
import {type Actor,type Authority} from './auth'
import {execute,fail,find,load,rows,type Row} from './model'
import {noticeDue,noticeStop} from './status-notices'
import {e} from './ui/common'

const scheduler={id:'mallet-status-mail',name:'Repair status email',role:'system' as const}
const ownerGrant=(actor:Actor,authority:Authority):Authority=>({sql:`(${authority.sql}) AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner' AND status='active')`,params:[...authority.params,actor.id]})
export async function statusNoticeCommand(original:Bindings,actor:Actor,authority:Authority,command:string,input:any){
 const env=runtimeBindings(original)
 if(actor.role!=='owner')fail('FORBIDDEN','Only the current owner manages repair-status email.',null,403)
 const grant=ownerGrant(actor,authority)
 const local=command==='statusNotice.approve'?{sql:`(${grant.sql}) AND EXISTS(SELECT 1 FROM mallet_status_authority a JOIN oa_operators o ON o.id=a.owner_id WHERE a.consent_id=? AND o.id=? AND o.version=a.owner_version AND o.role='owner' AND o.status='active')`,params:[...grant.params,input.consentId,actor.id]}:grant
 const row=await execute(env.DB,actor as any,command,input,local)
 if(command==='statusNotice.consent')await env.DB.prepare(`INSERT INTO mallet_status_authority SELECT ?,id,version FROM oa_operators WHERE id=? AND (${grant.sql})`).bind(row.id,actor.id,...grant.params).run()
 return row
}
async function currentAuthority(env:Bindings,r:Row){
 return !!await env.DB.prepare("SELECT a.consent_id FROM mallet_status_authority a JOIN oa_operators o ON o.id=a.owner_id WHERE a.consent_id=? AND o.id=? AND o.version=a.owner_version AND o.role='owner' AND o.status='active'").bind(r.consentId,r.by.id).first()
}
/** Claim before handoff; a crash is uncertain and can never cause an automatic resend. */
export async function runStatusNotices(original:Bindings,at:number){
 const env=runtimeBindings(original),now=new Date(at).toISOString(),snapshot=await load(env.DB)
 const local=(await env.DB.prepare("SELECT a.consent_id FROM mallet_status_authority a JOIN oa_operators o ON o.id=a.owner_id WHERE o.version=a.owner_version AND o.role='owner' AND o.status='active'").all<{consent_id:string}>()).results.map(r=>r.consent_id)
 await execute(env.DB,scheduler,'statusNotice.sweep',{localIds:local},undefined,now)
 for(const candidate of rows(snapshot,'statusNotice').filter(r=>r.status==='claimed'||r.status==='pending'&&noticeDue(r,now)).sort((a,b)=>a.dueAt.localeCompare(b.dueAt)||a.id.localeCompare(b.id)).slice(0,100)){
  let r=candidate
  if(r.status==='claimed'){
   if(Date.parse(r.claimedAt)+60000<=at)try{await execute(env.DB,scheduler,'statusNotice.outcome',{id:r.id,version:r.version,status:'uncertain',provider:'interrupted'},undefined,now)}catch{}
   continue
  }
  try{r=await execute(env.DB,scheduler,'statusNotice.claim',{id:r.id,version:r.version},undefined,now)}catch{continue}
  let status='skipped',provider='none',providerReference=''
  try{
   const current=await load(env.DB),live=find(current,'statusNotice',r.id),handoffNow=new Date(Math.max(at,Date.now())).toISOString()
   if(await currentAuthority(env,r)&&!noticeStop(current,live,handoffNow)&&noticeDue(live,handoffNow)){
    const mail=operatorMail(env)
    if(!mail){status='failed';provider='unavailable'}
    else{
     const result=await mail.send({deliveryId:r.id,from:String(env.MAIL_FROM??''),to:[r.to],subject:'Your repair: '+r.kind,text:r.content,html:'<p>'+e(r.content).replaceAll('\n','<br>')+'</p>',headers:{}})
     status=['rejected','rate_limited','unavailable'].includes(result.status)?'failed':result.status
     if(!['accepted','development','failed','uncertain'].includes(status))status='uncertain'
     provider=result.provider??'mail';providerReference=result.providerMessageId??''
    }
   }
  }catch{status='uncertain';provider='mail'}
  r=find(await load(env.DB),'statusNotice',r.id)
  if(r.status==='claimed')await execute(env.DB,scheduler,'statusNotice.outcome',{id:r.id,version:r.version,status,provider,providerReference},undefined,now)
 }
}
