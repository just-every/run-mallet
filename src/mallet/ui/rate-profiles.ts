import {area,box,e,field,form,money,rows,select,when} from './common'

function editor(jobId:string,profile?:any) {
 const revision=profile?.revisions.at(-1)
 return form('rateProfile.save',`${field('Profile name','name','text',revision?.name??'','required maxlength="200"')}${select('Pricing profile kind','kind',[['customer','Customer'],['fleet','Fleet']],revision?.kind??'customer')}${field('Labor hourly rate (USD)','laborRateUsd','number',revision?revision.laborRateCents/100:'','required min="0" max="10000000" step="0.01"')}${area('Reason for this revision','reason','','required maxlength="2000"')}`,profile?'Save rate revision':'Create rate profile',{jobId,version:profile?.version??0,...(profile?{id:profile.id}:{})})
}

export function rateProfilePanel(state:any,jobId:string):string {
 return box('Customer and fleet labor rates',`<p>Choose a named hourly rate when preparing an estimate. Each estimate keeps the selected revision; later changes apply to new drafts. A pricing profile does not create a customer or fleet account.</p>${rows(state,'rateProfile').map(profile=>{
  const current=profile.revisions.at(-1)
  return `<details><summary>${e(current.name)} · ${e(current.kind)} · ${money(current.laborRateCents)} per hour · revision ${e(current.n)}</summary>${editor(jobId,profile)}<details><summary>Rate history</summary><ul>${profile.revisions.map((revision:any)=>`<li>Revision ${e(revision.n)} · ${e(revision.name)} · ${e(revision.kind)} · ${money(revision.laborRateCents)} per hour · ${e(revision.by.name)} · ${when(revision.at)} · ${e(revision.reason)}</li>`).join('')}</ul></details></details>`
 }).join('')}<details><summary>Create a rate profile</summary>${editor(jobId)}</details>`,{id:'rate-profiles'})
}

export function rateProfileFields(state:any):string {
 const options:[string,string][]=[['','Use entered labor prices'],...rows(state,'rateProfile').map(profile=>{
  const revision=profile.revisions.at(-1)
  return [JSON.stringify({id:profile.id,version:profile.version}),`${revision.name} · ${revision.kind} · ${money(revision.laborRateCents)} per hour · revision ${revision.n}`] as [string,string]
 })]
 return select('Labor rate profile','rateProfileSource',options)
}
