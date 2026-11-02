import type {Bindings} from '../../auth.server'
import type {Actor,Authority} from '../auth'
import {expectVersion,fail,find,integer,load,object,text} from '../model'
import {verifyStripePayment} from '../payment-door'
import {readJob} from './store'
import {view,type Job,type Outcome} from './types'

export type PaymentCheckPayload={invoiceId:string;version:number;paymentIntentId:string;requestedBy:{id:string;name:string;version:number};consentEvidence:string}
type PaymentJob={id:string;kind:string;payload:unknown;attempts:number;dispatched_at:number|null}
type Owner={id:string;display_name:string;version:number}
const kind='stripe-payment-check'
const encode=(p:PaymentCheckPayload)=>JSON.stringify({invoiceId:p.invoiceId,version:p.version,paymentIntentId:p.paymentIntentId,requestedBy:{id:p.requestedBy.id,name:p.requestedBy.name,version:p.requestedBy.version},consentEvidence:p.consentEvidence})
function payload(raw:unknown):PaymentCheckPayload{
 const p=object(raw),by=object(p.requestedBy)
 if(Object.keys(p).sort().join(',')!=='consentEvidence,invoiceId,paymentIntentId,requestedBy,version'||Object.keys(by).sort().join(',')!=='id,name,version')fail('JOB_INPUT','Payment checks contain only invoice identifiers and owner approval.',null,400)
 return {invoiceId:text(p.invoiceId,'invoiceId'),version:integer(p.version,'invoice version',1),paymentIntentId:text(p.paymentIntentId,'paymentIntentId'),requestedBy:{id:text(by.id,'approving owner'),name:text(by.name,'approving owner name'),version:integer(by.version,'approving owner version',1)},consentEvidence:text(p.consentEvidence,'payment check approval evidence',2000)}
}
function ownerGuard(actor:Actor,authority:Authority){
 if(actor.role!=='owner'||!authority?.sql||!Array.isArray(authority.params))fail('FORBIDDEN','Only the current owner may approve a background payment check.',null,403)
 return {sql:`(${authority.sql}) AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner' AND status='active')`,params:[...authority.params,actor.id]}
}
async function currentOwner(env:Bindings,actor:Actor,authority:Authority){
 const grant=ownerGuard(actor,authority),owner=await env.DB.prepare(`SELECT id,display_name,version FROM oa_operators WHERE id=? AND (${grant.sql})`).bind(actor.id,...grant.params).first<Owner>()
 if(!owner)fail('FORBIDDEN','This owner session no longer authorizes a background payment check.',null,403)
 return {grant,owner}
}
const assertion=(env:Bindings,sql:string,params:any[])=>env.DB.prepare(`INSERT INTO mallet_assert(ok) SELECT CASE WHEN (${sql}) THEN 1 ELSE 0 END`).bind(...params)
const invoiceGuard=(invoice:any)=>({sql:"EXISTS(SELECT 1 FROM mallet_records WHERE kind='invoice' AND id=? AND revision=? AND value=?)",params:[invoice.id,invoice.version,JSON.stringify(invoice)]})
async function guardedBatch(env:Bindings,statements:D1PreparedStatement[]){
 try{await env.DB.batch([...statements,env.DB.prepare('DELETE FROM mallet_assert')])}
 catch(error){if(/CHECK constraint failed.*(?:mallet_assert|ok)/i.test(String(error)))fail('JOB_CHANGED','The job, invoice or owner authority changed. Review before continuing.');throw error}
}
async function checkedInvoice(env:Bindings,input:{invoiceId:string;version:number}){
 const invoice=find(await load(env.DB),'invoice',input.invoiceId);expectVersion(invoice,input.version)
 if(!['approved','exported'].includes(invoice.status))fail('PAYMENT_INVOICE','Approve the exact invoice before scheduling a provider check.')
 return invoice
}

/** Explicit owner approval grants this single read-only provider job standing
 * authority, bound to the operator's current version. No session/key is saved. */
export async function enqueuePaymentCheck(env:Bindings,actor:Actor,authority:Authority,input:any){
 const p=object(input),{grant,owner}=await currentOwner(env,actor,authority)
 if(p.consent!==true)fail('JOB_CONSENT','Explicitly approve this read-only Stripe payment check.',null,400)
 const requested=payload({invoiceId:p.invoiceId,version:p.version,paymentIntentId:p.paymentIntentId,requestedBy:{id:owner.id,name:owner.display_name,version:owner.version},consentEvidence:p.consentEvidence}),invoice=await checkedInvoice(env,requested),guard=invoiceGuard(invoice)
 const eventKey=kind+':'+text(p.operationId,'operationId',100),serialized=encode(requested),now=Date.now()
 const existing=await env.DB.prepare('SELECT * FROM mallet_jobs WHERE event_key=?').bind(eventKey).first<Job>()
 if(existing){if(existing.kind!==kind||existing.payload!==serialized)fail('JOB_REPLAY','This operation already has different payment identifiers or owner approval.');await guardedBatch(env,[assertion(env,grant.sql,grant.params)]);return view(existing)}
 await guardedBatch(env,[assertion(env,grant.sql,grant.params),assertion(env,guard.sql,guard.params),env.DB.prepare("INSERT OR IGNORE INTO mallet_jobs(id,event_key,kind,payload,due_at,status,created_at,updated_at) VALUES(?,?,?, ?,?,'pending',?,?)").bind(crypto.randomUUID(),eventKey,kind,serialized,now,now,now)])
 const saved=await env.DB.prepare('SELECT * FROM mallet_jobs WHERE event_key=?').bind(eventKey).first<Job>()
 if(!saved||saved.kind!==kind||saved.payload!==serialized)fail('JOB_REPLAY','This operation already has different payment identifiers or owner approval.')
 return view(saved)
}

/** The finance door performs GET only and deduplicates captured funds. Current
 * owner and exact job authority are checked before the GET and at its commit. */
export async function dispatchPaymentCheck(env:Bindings,job:PaymentJob):Promise<Outcome>{
 const outcome=(status:Outcome['status']):Outcome=>({status,provider:'stripe',providerMessageId:null})
 if(job.kind!==kind)return outcome('skipped')
 let p:PaymentCheckPayload
 try{p=payload(job.payload)}catch{return outcome('rejected')}
 const authority={sql:"EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner' AND status='active' AND version=?) AND EXISTS(SELECT 1 FROM mallet_jobs WHERE id=? AND kind=? AND payload=? AND status='dispatching' AND attempts=? AND dispatched_at=?)",params:[p.requestedBy.id,p.requestedBy.version,job.id,kind,encode(p),job.attempts,job.dispatched_at]}
 const owner=await env.DB.prepare(`SELECT id,display_name,version FROM oa_operators WHERE id=? AND (${authority.sql})`).bind(p.requestedBy.id,...authority.params).first<Owner>()
 if(!owner)return outcome('skipped')
 try{
  await verifyStripePayment(env,{id:owner.id,name:owner.display_name,role:'owner'},authority,{invoiceId:p.invoiceId,version:p.version,paymentIntentId:p.paymentIntentId})
  return outcome('accepted')
 }catch(error){
  const code=(error as any)?.code
  if(code==='PAYMENT_CONFIGURATION')return outcome('unavailable')
  if(code==='PAYMENT_PROVIDER')return outcome('unavailable')
  if(['VERSION','NOT_FOUND','PAYMENT_INVOICE','PAYMENT_UNSETTLED','PAYMENT_AMOUNT','PAYMENT_REPLAY','INPUT'].includes(code))return outcome('rejected')
  if(['FORBIDDEN','CONCURRENT_CHANGE'].includes(code))return outcome('skipped')
  return outcome('uncertain')
 }
}

/** A failed/uncertain GET may be explicitly reapproved. Reminder recovery
 * remains resolve-only; this function never changes that outbound-mail policy. */
export async function recoverPaymentCheck(env:Bindings,actor:Actor,authority:Authority,input:any){
 const p=object(input),{grant,owner}=await currentOwner(env,actor,authority),id=text(p.id,'job id',100),reason=text(p.reason,'recovery reason',2000)
 if(!['replay','resolve'].includes(p.action))fail('JOB_INPUT','Choose replay or resolve.',null,400)
 const row=await env.DB.prepare('SELECT * FROM mallet_jobs WHERE id=?').bind(id).first<Job>()
 if(!row||row.kind!==kind)fail('NOT_FOUND','That Stripe payment job does not exist.',null,404)
 if(!['failed','uncertain'].includes(row.status))fail('JOB_RECOVERY','Only a failed or uncertain provider GET can be recovered.')
 const previous=payload(JSON.parse(row.payload)),replay=p.action==='replay',now=Date.now()
 if(replay&&p.consent!==true)fail('JOB_CONSENT','Explicitly approve one more read-only provider check.',null,400)
 const replayEvidence=replay?text(p.consentEvidence,'new provider-check approval evidence',2000):null
 // Keep the original operation's consent binding stable. A renewed owner
 // attribution is explicit recovery authority; its new consent is audited.
 const next=replay?{...previous,requestedBy:{id:owner.id,name:owner.display_name,version:owner.version}}:previous
 const invoice=replay?await checkedInvoice(env,next):null,exact=invoice?invoiceGuard(invoice):null
 await guardedBatch(env,[assertion(env,grant.sql,grant.params),assertion(env,"EXISTS(SELECT 1 FROM mallet_jobs WHERE id=? AND kind=? AND status=? AND payload=? AND attempts=? AND updated_at=?)",[id,kind,row.status,row.payload,row.attempts,row.updated_at]),...(exact?[assertion(env,exact.sql,exact.params)]:[]),
  env.DB.prepare('INSERT INTO mallet_job_recoveries(id,job_id,action,actor_json,reason,at,previous_outcome,previous_attempts) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),id,p.action,JSON.stringify({id:owner.id,name:owner.display_name,role:'owner',version:owner.version,...(replay?{consent:true,consentEvidence:replayEvidence}:{})}),reason,now,row.outcome,row.attempts),
  env.DB.prepare('UPDATE mallet_jobs SET status=?,payload=?,due_at=?,lease_token=NULL,lease_until=NULL,dispatched_at=NULL,outcome=?,updated_at=? WHERE id=?').bind(replay?'pending':'resolved',encode(next),replay?now:row.due_at,replay?null:row.outcome,now,id)
 ])
 return readJob(env.DB,id)
}
