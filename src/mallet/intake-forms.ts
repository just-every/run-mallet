import {createHash} from 'node:crypto'
import {bump,choice,event,expectVersion,fail,find,integer,put,rows,text,who,type Handler} from './model'
export const intakeFormCommands=['intakeForm.publish','intakeForm.create','intakeForm.revoke','intakeForm.customerSave','intakeForm.copyClaim','intakeForm.copyOutcome'] as const
export const internalIntakeFormCommands=['intakeForm.customerSave','intakeForm.copyClaim','intakeForm.copyOutcome']
export const FORM_CONSENT='I agree to the exact diagnostic fee, storage and teardown terms shown here, and to sign and receive this intake record electronically. Ask the shop for a paper copy. This does not authorize additional repair work or a payment charge.'
export const intakeForms:Handler=(c,command,p)=>{
 if(!(intakeFormCommands as readonly string[]).includes(command))return
 if(!internalIntakeFormCommands.includes(command)&&!['owner','admin'].includes(c.actor.role))fail('FORBIDDEN','Only the owner or service advisor publishes or issues intake forms.',null,403)
 if(command==='intakeForm.publish'){
  if(!Array.isArray(p.fields)||p.fields.length>20)fail('INPUT','Configure at most 20 custom text fields.',null,400)
  const fields=p.fields.map((f:any)=>{const key=text(f.key,'field key',40);if(!/^[a-z][a-z0-9_-]*$/.test(key)||key==='symptom'||typeof f.required!=='boolean')fail('INPUT','Each field needs a unique stable key, label and required choice.',null,400);return {key,label:text(f.label,'field label',200),required:f.required}})
  if(new Set(fields.map((f:any)=>f.key)).size!==fields.length)fail('INPUT','Custom field keys must be unique.',null,400)
  const previous=p.templateId?find(c.s,'intakeTemplate',p.templateId):null
  if(previous)expectVersion(previous,p.version)
  const revision={n:(previous?.revisions.length??0)+1,name:text(p.name,'template name',200),kind:choice(p.kind,['vehicle','device'],'intake type'),fields,diagnosticFeeCents:integer(p.diagnosticFeeCents,'diagnostic fee in USD cents'),storageTerms:text(p.storageTerms,'storage terms',4000),teardownTerms:text(p.teardownTerms,'teardown terms',4000),by:who(c),at:c.now}
  const saved=previous?bump(c.s,'intakeTemplate',previous,{revisions:[...previous.revisions,revision]}):put(c.s,'intakeTemplate',{revisions:[revision]});event(c,command,null,saved.id,{revision:revision.n});return saved
 }
 if(command==='intakeForm.create'){
  const job=find(c.s,'job',p.jobId);expectVersion(job,p.version)
  const template=find(c.s,'intakeTemplate',p.templateId);expectVersion(template,p.templateVersion)
  const to=text(job.asset.customerEmail,'customer copy email',254)
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to))fail('INPUT','Record the visit customer email before issuing a form.',null,400)
  const row=put(c.s,'intakeForm',{jobId:job.id,assetId:job.assetId,asset:structuredClone(job.asset),templateId:template.id,template:structuredClone(template.revisions.at(-1)),to,answers:{},typedName:'',consent:false,status:'draft',lastErrors:[],expiresAt:new Date(Date.parse(c.now)+7*86400000).toISOString(),revoked:null,receipt:null,copy:null,by:who(c),at:c.now});event(c,command,job.id,row.id,{templateId:template.id,revision:row.template.n});return row
 }
 const row=find(c.s,'intakeForm',p.formId)
 if(command==='intakeForm.revoke'){
  expectVersion(row,p.version)
  if(row.revoked)fail('FORM_REVOKED','This form link is already revoked.')
  const saved=bump(c.s,'intakeForm',row,{revoked:{reason:text(p.reason,'revocation reason',2000),by:who(c),at:c.now}});event(c,command,row.jobId,row.id,{});return saved
 }
 if(c.actor.role!=='customer'||c.actor.id!=='intake-form:'+row.id)fail('FORBIDDEN','Use this intake form’s own scoped customer link.',null,403)
 if(row.revoked||row.expiresAt<=c.now)fail('NOT_FOUND','This intake link is unavailable.',null,404)
 if(command==='intakeForm.copyClaim'){
  if(row.status!=='signed'||row.copy)return null
  return bump(c.s,'intakeForm',row,{copy:{status:'claimed',at:c.now}})
 }
 if(command==='intakeForm.copyOutcome'){
  if(row.copy?.status!=='claimed')fail('FORM_COPY','Only the claimed copy send can record an outcome.')
  return bump(c.s,'intakeForm',row,{copy:{...row.copy,status:choice(p.status,['accepted','development','rejected','rate_limited','uncertain','unavailable'],'mail outcome'),provider:text(p.provider,'mail provider',100),at:c.now}})
 }
 if(row.status==='signed')return row
 expectVersion(row,p.version)
 if(!p.answers||typeof p.answers!=='object'||Array.isArray(p.answers))fail('INPUT','Save a field object.',null,400)
 const answers=Object.fromEntries(['symptom',...row.template.fields.map((f:any)=>f.key)].map(key=>[key,text(p.answers[key],key,2000,true)])),typedName=text(p.typedName,'typed signature',200,true),consent=p.consent===true
 const missing=[...(answers.symptom?[]:['symptom']),...row.template.fields.filter((f:any)=>f.required&&!answers[f.key]).map((f:any)=>f.key),...(typedName?[]:['typedName']),...(consent?[]:['consent'])]
 const {by:_templateActor,...publicTemplate}=row.template
 const signed=p.sign===true&&missing.length===0,base={formId:row.id,jobId:row.jobId,asset:row.asset,template:publicTemplate,answers,signature:{typedName,consentText:FORM_CONSENT,identityVerified:false,at:c.now},at:c.now,label:'Typed-name intake acknowledgment; customer identity is not verified.'}
 const receipt=signed?{...base,sha256:createHash('sha256').update(JSON.stringify(base)).digest('hex')}:null
 const saved=bump(c.s,'intakeForm',row,{answers,typedName,consent,status:signed?'signed':'draft',lastErrors:p.sign===true?missing:[],receipt})
 event(c,command,row.jobId,row.id,{status:saved.status,templateRevision:row.template.n});return saved
}
