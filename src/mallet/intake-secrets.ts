import type {Bindings} from '../auth.server'
import type {Actor,Authority} from './auth'
import {fail,text} from './model'
import {guarded,jobScope} from './media/storage'
import {instant} from './workshop'
const bytes=(s:string)=>Uint8Array.from(atob(s),x=>x.charCodeAt(0))
const base64=(b:Uint8Array)=>btoa(String.fromCharCode(...b))
async function key(env:Bindings){return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',new TextEncoder().encode('mallet-intake-v1:'+env.SESSION_SECRET)),{name:'AES-GCM'},false,['encrypt','decrypt'])}
export async function expireIntakeSecrets(env:Bindings,at=new Date().toISOString()){await env.DB.prepare("DELETE FROM mallet_intake_secrets WHERE expires_at<=? OR job_id IN (SELECT json_extract(value,'$.jobId') FROM mallet_records WHERE kind='handover')").bind(at).run()}
export async function intakeSecret(env:Bindings,actor:Actor,authority:Authority,command:string,p:any){
 if(actor.role!=='owner')fail('FORBIDDEN','Only the current owner may handle temporary unlock secrets.',null,403)
 const scope=await jobScope(env.DB,actor,authority,text(p.jobId,'jobId')),now=new Date().toISOString()
 await expireIntakeSecrets(env,now)
 let id:string,result:any,queries:any[]=[{sql:"INSERT INTO mallet_assert(ok) SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM mallet_records WHERE kind='handover' AND json_extract(value,'$.jobId')=?) THEN 1 ELSE 0 END",params:[scope.jobId]}]
 if(command==='intake.secretStore'){
  const purpose=text(p.purpose,'explicit unlock purpose',500),value=text(p.secret,'temporary unlock secret',1000),expiresAt=instant(p.expiresAt,'purpose end time')
  if(p.consent!==true||expiresAt<=now||Date.parse(expiresAt)-Date.parse(now)>86400000)fail('SECRET_CONSENT','Obtain explicit consent and set a purpose end within 24 hours.',null,400)
  id=crypto.randomUUID();const iv=crypto.getRandomValues(new Uint8Array(12)),cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(scope.jobId+':'+id)},await key(env),new TextEncoder().encode(value))
  queries.push({sql:'INSERT INTO mallet_intake_secrets(id,job_id,purpose,expires_at,cipher,iv) VALUES(?,?,?,?,?,?)',params:[id,scope.jobId,purpose,expiresAt,base64(new Uint8Array(cipher)),base64(iv)]})
  result={id,jobId:scope.jobId,purpose,expiresAt,label:'Owner-only temporary secret; excluded from backups. End the purpose as soon as unlock work finishes.'}
 }else{
  id=text(p.secretId,'secretId');const found=await guarded(env.DB,scope,[{sql:'SELECT * FROM mallet_intake_secrets WHERE id=? AND job_id=? AND expires_at>?',params:[id,scope.jobId,now]}]),row=found[0].results[0] as any
  if(!row)fail('NOT_FOUND','This temporary secret is unavailable or its purpose has ended.',null,404)
  if(command==='intake.secretEnd'){queries.push({sql:'DELETE FROM mallet_intake_secrets WHERE id=? AND job_id=?',params:[id,scope.jobId]});result={id,ended:true}}
  else if(command==='intake.secretReveal'){
   text(p.reason,'reason for secret access',500)
   queries.push({sql:'INSERT INTO mallet_assert(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM mallet_intake_secrets WHERE id=? AND job_id=? AND expires_at>?) THEN 1 ELSE 0 END',params:[id,scope.jobId,now]})
   result={id,secret:new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(row.iv),additionalData:new TextEncoder().encode(scope.jobId+':'+id)},await key(env),bytes(row.cipher)))}
  }else return fail('COMMAND','Unknown temporary secret command.',null,400)
 }
 const auditId=crypto.randomUUID(),audit={id:auditId,version:1,jobId:scope.jobId,secretId:id,action:command,...(command==='intake.secretStore'?{purpose:result.purpose,expiresAt:result.expiresAt,consent:true}:{}),by:{id:actor.id,name:actor.name,role:actor.role},at:now}
 queries.push({sql:'INSERT INTO mallet_records(kind,id,revision,value) VALUES(?,?,1,?)',params:['intakeSecretAudit',auditId,JSON.stringify(audit)]})
 await guarded(env.DB,scope,queries);return result
}
