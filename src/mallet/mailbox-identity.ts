import {rows,type Row,type State} from './model'

export const normalizedMailbox=(value:unknown)=>typeof value==='string'?value.trim().toLowerCase():''

/** A mailbox is a lookup key, never permission to move another person's records. */
export function mailboxOwnerIds(state:State,email:unknown):string[]{
 const key=normalizedMailbox(email),ids=new Set<string>()
 if(!key)return []
 const contacts=new Set(rows(state,'contact').filter(c=>normalizedMailbox(c.email)===key).map(c=>c.id))
 for(const account of rows(state,'customerAccount'))if(account.contactIds?.some((id:string)=>contacts.has(id)))ids.add(account.id)
 for(const asset of rows(state,'asset'))if(normalizedMailbox(asset.customerEmail)===key){
  const owner=asset.customerEmailAccountId??asset.customerAccountId
  if(owner)ids.add(owner)
 }
 return [...ids]
}

/** Historical asset mailboxes belong to the account linked when they were set. */
export function historicalMailboxes(state:State,accountIds:Set<string>,contactIds:Set<string>):Set<string>{
 const emails=new Set<string>(),add=(value:unknown)=>{const key=normalizedMailbox(value);if(key)emails.add(key)}
 for(const contact of rows(state,'contact').filter(c=>contactIds.has(c.id))){add(contact.email);for(const old of contact.history??[])add(old.email)}
 const events=rows(state,'event')
 for(const asset of rows(state,'asset')){
  const links=events.filter(e=>e.kind==='customer.linkAsset'&&e.subjectId===asset.id).sort((a,b)=>a.at.localeCompare(b.at))
  const owner=asset.customerEmailAccountId??asset.customerAccountId
  if(accountIds.has(owner))add(asset.customerEmail)
  for(const event of events.filter(e=>e.assetId===asset.id&&e.kind.startsWith('asset.'))){
   const link=links.filter(l=>l.at<=event.at).at(-1)??links[0]
   if(link&&accountIds.has(link.data.accountId))add(event.data?.after?.customerEmail??event.data?.customerEmail)
  }
 }
 for(const billing of rows(state,'customerBilling').filter(b=>accountIds.has(b.snapshot?.accountId))){
  const job=rows(state,'job').find(j=>j.id===billing.jobId);add(job?.asset?.customerEmail)
 }
 return emails
}

export function ownsMailboxRecord(row:Row,accountIds:Set<string>,legacyEmails:Set<string>,field='email'):boolean{
 // Shared addresses cannot establish exclusive ownership. Keep all recorded links.
 if(row.mailboxOwnerIds?.length)return row.mailboxOwnerIds.every((id:string)=>accountIds.has(id))
 return legacyEmails.has(normalizedMailbox(row[field]))
}
