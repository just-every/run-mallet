import {createHash} from 'node:crypto'
import {voidFleetAccountApprovals,voidFleetApprovals} from './fleet-pending'
// Owner/admin-reviewed contacts and account aliases retain provenance; merging never rewrites a job or invoice.
import {bump,choice,event,expectVersion,fail,find,put,rows,text,who,type Context,type Handler,type State,type Row} from './model'
export const accountCommands=['contact.save','customer.save','customer.linkAsset','customer.driver','customer.mergePreview','customer.merge']
const email=(value:unknown)=>{const e=text(value,'email',254,true);if(e&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))fail('INPUT','Provide a valid contact email.',null,400);return e}
function active(s:State,id:unknown){const account=find(s,'customerAccount',id);if(account.mergedInto)fail('MERGED_ACCOUNT','Use the surviving account; the source remains read-only history.');return account}
function contactIds(s:State,value:unknown){if(!Array.isArray(value)||!value.length||value.length>100)fail('INPUT','Choose 1–100 contacts.',null,400);const ids=[...new Set(value.map(v=>text(v,'contact')))];ids.forEach(id=>find(s,'contact',id));return ids}
export function customerSearch(s:State,query:string){
 const q=text(query,'search',200,true).toLowerCase(),digits=q.replace(/\D/g,'')
 return rows(s,'customerAccount').filter(a=>!a.mergedInto).filter(a=>{
  const aliases=rows(s,'customerAccount').filter(x=>x.mergedInto===a.id),ids=new Set([a.id,...aliases.map(x=>x.id)]),contacts=rows(s,'contact').filter(x=>a.contactIds.includes(x.id)),assets=rows(s,'asset').filter(x=>ids.has(x.customerAccountId)),parts=[a.name,...aliases.map(x=>x.name),...contacts.flatMap(c=>[c.name,c.email,c.phone]),...assets.flatMap(v=>[v.label,v.identifier])]
  return !q||parts.some(v=>String(v).toLowerCase().includes(q))||digits.length>=3&&contacts.some(c=>c.phone.replace(/\D/g,'').includes(digits))
 }).sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id))
}
export function customerBillingSnapshot(s:State,asset:Row){
 if(!asset.customerAccountId)return null
 const account=active(s,asset.customerAccountId),contact=(id:string|null)=>id?structuredClone(find(s,'contact',id)):null
 return {accountId:account.id,kind:account.kind,name:account.name,taxStatus:account.taxStatus,payer:contact(account.payerId),billingContact:contact(account.billingContactId),driver:contact(asset.driverContactId??account.driverId),authorizer:contact(account.authorizerId),recordedAt:asset.updatedAt??asset.createdAt}
}
export function mergePreview(s:State,p:any){
 const source=active(s,p.sourceId),target=active(s,p.targetId);expectVersion(source,p.sourceVersion);expectVersion(target,p.targetVersion)
 if(source.id===target.id)fail('INPUT','Choose two distinct accounts.',null,400)
 if(source.kind!==target.kind)fail('MERGE_CONFLICT','Different account kinds need separate identity review; no automatic merge.')
 const survivor={...structuredClone(target),contactIds:[...new Set([...target.contactIds,...source.contactIds])]},vehicles=rows(s,'asset').filter(a=>[source.id,target.id].includes(a.customerAccountId)).map(a=>({id:a.id,version:a.version,label:a.label,identifier:a.identifier,driverContactId:a.driverContactId}))
 const preview={source:structuredClone(source),survivor,contacts:rows(s,'contact').filter(c=>survivor.contactIds.includes(c.id)),vehicles}
 return {...preview,previewHash:createHash('sha256').update(JSON.stringify(preview)).digest('hex')}
}
function audit(c:Context,command:string,account:Row,data:any){event(c,command,null,account.id,data);return account}
export const customers:Handler=(c,command,p)=>{
 if(!accountCommands.includes(command))return
 if(!['owner','admin'].includes(c.actor.role))fail('FORBIDDEN','Owner and admin operators manage contacts and account relationships.',null,403)
 if(command==='customer.mergePreview')return mergePreview(c.s,p)
 if(command==='contact.save'){
  const prior=p.contactId?find(c.s,'contact',p.contactId):null;if(prior)expectVersion(prior,p.version)
  const fields={name:text(p.name,'contact name'),email:email(p.email),phone:text(p.phone,'phone',100,true),communication:choice(p.communication,['none','email','phone'],'communication preference'),notes:text(p.notes,'contact notes',4000,true),by:who(c),at:c.now}
  const row=prior?bump(c.s,'contact',prior,{...fields,history:[...(prior.history??[]),{...structuredClone(prior),history:undefined}]}):put(c.s,'contact',{...fields,history:[]})
  if(prior)voidFleetAccountApprovals(c,rows(c.s,'customerAccount').filter(a=>a.kind==='fleet'&&a.authorizerId===row.id).map(a=>a.id),'The fleet authorizer contact changed; review the account and authorize a new revision.')
  event(c,command,null,row.id,{version:row.version});return row
 }
 if(command==='customer.save'){
  const prior=p.customerId?active(c.s,p.customerId):null;if(prior)expectVersion(prior,p.version)
  const ids=contactIds(c.s,p.contactIds),role=(key:string,required=false)=>{const id=p[key]?text(p[key],key):null;if(required&&!id)fail('INPUT','Choose a payer and billing contact.',null,400);if(id&&!ids.includes(id))fail('CONTACT_SCOPE','Each account role must be one of its contacts.');return id}
  const fields={payerRevision:(prior?.payerRevision??1)+(prior&&prior.payerId!==p.payerId?1:0),name:text(p.name,'account name'),kind:choice(p.kind,['person','household','business','fleet'],'account kind'),contactIds:ids,payerId:role('payerId',true),billingContactId:role('billingContactId',true),driverId:role('driverId'),authorizerId:role('authorizerId'),taxStatus:choice(p.taxStatus,['standard','declared-exempt','unknown'],'tax status'),notes:text(p.notes,'account notes',4000,true),by:who(c),at:c.now}
  const row=prior?bump(c.s,'customerAccount',prior,{...fields,history:[...prior.history,{...structuredClone(prior),history:undefined}]}):put(c.s,'customerAccount',{...fields,history:[],mergedInto:null})
  if(prior&&(prior.kind==='fleet'||row.kind==='fleet'))voidFleetAccountApprovals(c,[row.id],'The fleet account changed; review the account and authorize a new revision.')
  return audit(c,command,row,{version:row.version})
 }
 if(command==='customer.merge'){
  const source=active(c.s,p.sourceId),target=active(c.s,p.targetId);expectVersion(source,p.sourceVersion);expectVersion(target,p.targetVersion)
  if(source.id===target.id)fail('INPUT','Choose two distinct accounts.',null,400)
  if(source.kind!==target.kind)fail('MERGE_CONFLICT','Different account kinds need separate identity review; no automatic merge.')
  const preview=mergePreview(c.s,p)
  if(p.previewHash!==preview.previewHash)fail('MERGE_PREVIEW','Preview the exact current survivor before merging.')
  const identityEvidence=text(p.identityEvidence,'identity-match evidence',4000),reason=text(p.reason,'merge reason',2000),consentEvidence=text(p.consentEvidence,'explicit merge consent evidence',4000),sourceSnapshot=structuredClone(source),targetSnapshot=structuredClone(target)
  const receipt=put(c.s,'customerMerge',{sourceId:source.id,targetId:target.id,sourceSnapshot,targetSnapshot,reason,identityEvidence,consentEvidence,previewHash:preview.previewHash,by:who(c),at:c.now})
  if(source.kind==='fleet')voidFleetAccountApprovals(c,[source.id,target.id],'The fleet accounts merged; review the surviving account and authorize a new revision.')
  // The survivor's role choices remain explicit. Alias contacts and vehicles move without granting a billing identity.
  bump(c.s,'customerAccount',target,{contactIds:[...new Set([...target.contactIds,...source.contactIds])],history:[...target.history,{...targetSnapshot,history:undefined}],mergeReceipts:[...(target.mergeReceipts??[]),receipt.id]})
  const saved=bump(c.s,'customerAccount',source,{mergedInto:target.id,mergeReceiptId:receipt.id})
  for(const asset of rows(c.s,'asset').filter(a=>a.customerAccountId===source.id))bump(c.s,'asset',asset,{customerAccountId:target.id,customerName:target.name,updatedAt:c.now})
  // Earlier aliases follow the survivor; their own receipts remain unchanged.
  for(const alias of rows(c.s,'customerAccount').filter(a=>a.mergedInto===source.id))bump(c.s,'customerAccount',alias,{mergedInto:target.id})
  audit(c,command,saved,{receiptId:receipt.id,reason});return receipt
 }
 const asset=find(c.s,'asset',p.assetId);expectVersion(asset,p.version)
 const account=active(c.s,p.customerId);expectVersion(account,p.customerVersion)
 if(command==='customer.driver'&&asset.customerAccountId!==account.id)fail('ACCOUNT_SCOPE','Choose the account linked to this vehicle.')
 const driverId=p.driverId?text(p.driverId,'driver'):account.driverId
 if(driverId&&!account.contactIds.includes(driverId))fail('CONTACT_SCOPE','The driver must be one of this account’s contacts.')
 if(command==='customer.linkAsset'&&asset.customerAccountId!==account.id&&(account.kind==='fleet'||rows(c.s,'customerAccount').some(a=>a.id===asset.customerAccountId&&a.kind==='fleet')))voidFleetApprovals(c,new Set([asset.id]),'The vehicle fleet account changed; review the account and authorize a new revision.')
 const saved=bump(c.s,'asset',asset,{customerEmailAccountId:asset.customerEmailAccountId??asset.customerAccountId??account.id,customerAccountId:account.id,customerName:account.name,driverContactId:driverId,updatedAt:c.now})
 event(c,command,null,asset.id,{accountId:account.id,driverId,reason:text(p.reason,'relationship change reason',2000)});return saved
}
