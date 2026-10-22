import type {Bindings} from '../auth.server'
import type {Actor,Authority} from './auth'
import {fail,load,rows,text} from './model'
import {base64,bytes,createUnlockKey,readUnlockKey,destroyUnlockKeys,expireUnlockKeys} from './intake-vault'
import {guarded,jobScope} from './media/storage'
import {instant} from './workshop'
export async function purgeIntakeSecrets(env:Bindings,where:string,params:any[]=[]){
 const found=await env.DB.prepare('SELECT id FROM mallet_intake_secrets WHERE '+where).bind(...params).all<{id:string}>()
 // Destroy keys before removing ciphertext, so a partial failure fails closed.
 await destroyUnlockKeys(env,found.results.map(r=>r.id))
 if(found.results.length)await env.DB.batch(found.results.map(r=>env.DB.prepare('DELETE FROM mallet_intake_secrets WHERE id=?').bind(r.id)))
 return found.results.length
}
export async function expireIntakeSecrets(env:Bindings,at=new Date().toISOString()){
 await expireUnlockKeys(env,at)
 await purgeIntakeSecrets(env,"expires_at<=? OR job_id IN (SELECT json_extract(value,'$.jobId') FROM mallet_records WHERE kind='handover')",[at])
}
function refuseEcho(value:string,description:string){
 if(description.includes(value)||description.includes(value.trim()))fail('SECRET_ECHO','A purpose or access reason must not contain the unlock value.',null,400)
}
export async function intakeSecret(env:Bindings,actor:Actor,authority:Authority,command:string,p:any){
 if(actor.role!=='owner')fail('FORBIDDEN','Only the current owner may handle temporary unlock secrets.',null,403)
 const scope=await jobScope(env.DB,actor,authority,text(p.jobId,'jobId')),now=new Date().toISOString()
 await expireIntakeSecrets(env,now)
 let id:string,result:any,queries:any[]=[{sql:"INSERT INTO mallet_assert(ok) SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM mallet_records WHERE kind='handover' AND json_extract(value,'$.jobId')=?) THEN 1 ELSE 0 END",params:[scope.jobId]}]
 if(command==='intake.secretEraseCustomer'){
  if(p.confirm!=='ERASE')fail('CONFIRMATION','Confirm customer unlock-material erasure.',null,400)
  const reason=text(p.reason,'erasure request reason',500),state=await load(env.DB),job=rows(state,'job').find(j=>j.id===scope.jobId)!,asset=rows(state,'asset').find(a=>a.id===job.assetId)!
  const account=rows(state,'customerAccount').find(a=>a.id===asset.customerAccountId)
  if(!account)fail('CUSTOMER_ACCOUNT','Link the asset to a customer account before customer-wide unlock erasure.',null,400)
  const accounts=rows(state,'customerAccount'),survivor=(id:string):string=>{const seen=new Set<string>();while(accounts.find(a=>a.id===id)?.mergedInto&&!seen.has(id)){seen.add(id);id=accounts.find(a=>a.id===id)!.mergedInto}return id},customerId=survivor(account.id)
  const assets=new Set(rows(state,'asset').filter(a=>a.customerAccountId&&survivor(a.customerAccountId)===customerId).map(a=>a.id)),jobs=rows(state,'job').filter(j=>assets.has(j.assetId)).map(j=>j.id)
  await guarded(env.DB,scope,[])
  const count=jobs.length?await purgeIntakeSecrets(env,'job_id IN ('+jobs.map(()=>'?').join(',')+')',jobs):0
  id=crypto.randomUUID();result={id,jobId:scope.jobId,customerId,erased:count,reason}
 }else if(command==='intake.secretStore'){
  const purpose=text(p.purpose,'explicit unlock purpose',500),expiresAt=instant(p.expiresAt,'purpose end time')
  if(p.consent!==true||expiresAt<=now||Date.parse(expiresAt)-Date.parse(now)>86400000)fail('SECRET_CONSENT','Obtain explicit consent and set a purpose end within 24 hours.',null,400)
  text(p.secret,'temporary unlock secret',1000);const value=p.secret as string
  refuseEcho(value,purpose)
  id=crypto.randomUUID();const iv=crypto.getRandomValues(new Uint8Array(12)),cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(scope.jobId+':'+id)},await createUnlockKey(env,id,expiresAt),new TextEncoder().encode(value))
  queries.push({sql:'INSERT INTO mallet_intake_secrets(id,job_id,purpose,expires_at,cipher,iv) VALUES(?,?,?,?,?,?)',params:[id,scope.jobId,purpose,expiresAt,base64(new Uint8Array(cipher)),base64(iv)]})
  result={id,jobId:scope.jobId,purpose,expiresAt,label:'Owner-only temporary secret; excluded from backups. End the purpose as soon as unlock work finishes.'}
 }else{
  id=text(p.secretId,'secretId');const found=await guarded(env.DB,scope,[{sql:'SELECT * FROM mallet_intake_secrets WHERE id=? AND job_id=? AND expires_at>?',params:[id,scope.jobId,now]}]),row=found[0].results[0] as any
  if(!row)fail('NOT_FOUND','This temporary secret is unavailable or its purpose has ended.',null,404)
  if(command==='intake.secretEnd'){await destroyUnlockKeys(env,[id]);queries.push({sql:'DELETE FROM mallet_intake_secrets WHERE id=? AND job_id=?',params:[id,scope.jobId]});result={id,ended:true}}
  else if(command==='intake.secretReveal'){
   const reason=text(p.reason,'reason for secret access',500)
   queries.push({sql:'INSERT INTO mallet_assert(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM mallet_intake_secrets WHERE id=? AND job_id=? AND expires_at>?) THEN 1 ELSE 0 END',params:[id,scope.jobId,now]})
   result={id,secret:new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(row.iv),additionalData:new TextEncoder().encode(scope.jobId+':'+id)},await readUnlockKey(env,id),bytes(row.cipher)))}
   refuseEcho(result.secret,reason)
   result.reason=reason
  }else return fail('COMMAND','Unknown temporary secret command.',null,400)
 }
 const auditId=crypto.randomUUID(),audit={id:auditId,version:1,jobId:scope.jobId,secretId:id,action:command,...(command==='intake.secretEraseCustomer'?{customerId:result.customerId,erased:result.erased}:{}),...(command==='intake.secretReveal'?{reason:result.reason}:{}),...(command==='intake.secretStore'?{purpose:result.purpose,expiresAt:result.expiresAt,consent:true}:{}),by:{id:actor.id,name:actor.name,role:actor.role},at:now}
 queries.push({sql:'INSERT INTO mallet_records(kind,id,revision,value) VALUES(?,?,1,?)',params:['intakeSecretAudit',auditId,JSON.stringify(audit)]})
 try{await guarded(env.DB,scope,queries)}catch(error){if(command==='intake.secretStore')await destroyUnlockKeys(env,[id]);throw error}
 if(command==='intake.secretReveal')delete result.reason
 return result
}
