import {invoiceBalance} from './payments'
import type {Bindings} from '../auth.server'
import {digest} from './auth'
export const portalToken=()=>btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')
export const portalCookieName=(request:Request)=>{const u=new URL(request.url);return ['localhost','127.0.0.1','[::1]'].includes(u.hostname)?'mallet_portal_'+(u.port||(u.protocol==='https:'?'443':'80')):'mallet_portal'}
export const portalCookie=(request:Request)=>{const name=portalCookieName(request)+'=',entries=(request.headers.get('cookie')??'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(name));return entries.length===1?entries[0].slice(name.length):''}
// Recheck current membership, contact revision and account payer epoch on every read and token exchange.
export const currentPortal=`EXISTS(SELECT 1 FROM mallet_records a JOIN mallet_records c ON c.kind='contact' AND c.id=t.contact_id WHERE a.kind='customerAccount' AND a.id=t.account_id AND json_extract(a.value,'$.mergedInto') IS NULL AND coalesce(json_extract(a.value,'$.payerRevision'),1)=t.account_revision AND c.revision=t.contact_version AND EXISTS(SELECT 1 FROM json_each(a.value,'$.contactIds') WHERE value=t.contact_id))`
export async function portalRecords(env:Bindings,request:Request){
 const token=portalCookie(request);if(!/^[A-Za-z0-9_-]{43}$/.test(token))return null
 const hash=await digest(token),now=Date.now()
 const auth=await env.DB.prepare(`SELECT t.account_id,t.contact_id FROM mallet_portal_tokens t WHERE t.token_hash=? AND t.kind='session' AND t.used_at IS NULL AND t.expires_at>? AND ${currentPortal}`).bind(hash,now).first<{account_id:string;contact_id:string}>()
 if(!auth)return null
 // The same current-authority condition gates the data query, including a payer change between reads.
 const result=await env.DB.prepare(`SELECT r.kind,r.value FROM mallet_records r WHERE r.kind IN ('customerAccount','invoice','payment','creditNote','refund') AND EXISTS(SELECT 1 FROM mallet_portal_tokens t WHERE t.token_hash=? AND t.kind='session' AND t.used_at IS NULL AND t.expires_at>? AND ${currentPortal} AND EXISTS(SELECT 1 FROM mallet_records a WHERE a.kind='customerAccount' AND a.id=t.account_id AND json_extract(a.value,'$.payerId')=t.contact_id))`).bind(hash,now).all<{kind:string;value:string}>()
 const account=result.results.filter(r=>r.kind==='customerAccount').map(r=>JSON.parse(r.value)).find(a=>a.id===auth.account_id)
 if(!account)return {denied:true as const}
 const aliases=result.results.filter(r=>r.kind==='customerAccount').map(r=>JSON.parse(r.value)).filter(a=>a.mergedInto===account.id),ids=new Set([account.id,...aliases.map(a=>a.id)]),payments=result.results.filter(r=>r.kind==='payment').map(r=>JSON.parse(r.value))
 const invoices=result.results.filter(r=>r.kind==='invoice').map(r=>JSON.parse(r.value)).filter(i=>ids.has(i.billing?.accountId)&&['approved','exported'].includes(i.status)).map(i=>{
  const creditNotes=result.results.filter(r=>r.kind==='creditNote').map(r=>JSON.parse(r.value)).filter(n=>n.invoiceId===i.id),refunds=result.results.filter(r=>r.kind==='refund').map(r=>JSON.parse(r.value)).filter(r=>r.invoiceId===i.id)
  const balance=invoiceBalance({version:0,records:{payment:payments,creditNote:creditNotes,refund:refunds}},i)
  const tender=payments.filter(p=>p.invoiceId===i.id).map(p=>({amountCents:p.amountCents,method:p.method,at:p.at,verified:p.verified,label:p.verified?'Processor-verified captured payment':p.label}))
  return {id:i.id,number:i.number,at:i.preparedAt,vehicle:i.customer.label,identifier:i.customer.identifier,lines:i.lines.map((l:any)=>({description:l.description,quantity:l.quantity,totalCents:l.totalCents})),totalCents:i.totals.totalCents,paidCents:balance.paidCents,outstandingCents:balance.outstandingCents,creditedCents:balance.creditedCents,refundedCents:balance.refundedCents,credits:creditNotes.map(n=>({number:n.number,at:n.at,totalCents:n.totals.totalCents,salesTaxCents:n.totals.salesTaxCents,destination:n.destination})),refunds:refunds.map(r=>({amountCents:r.amountCents,method:r.method,status:r.status})),payments:tender}
 })
 return {account:{id:account.id,name:account.name},invoices,balanceCents:invoices.reduce((n,i)=>n+i.outstandingCents,0)}
}
