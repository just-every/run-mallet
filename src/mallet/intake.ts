import {bump,choice,event,expectVersion,fail,find,integer,put,rows,text,who,type Handler} from './model'
import {instant} from './workshop'
export const intakeCommands=['intake.record','intake.compare'] as const
export const CUSTODY_CONSENT='I acknowledge this exact condition and custody checklist and agree to sign and receive this receipt electronically. Ask the shop for a paper copy.'
export const intake:Handler=(c,command,p)=>{
 if(!(intakeCommands as readonly string[]).includes(command))return
 if(!['owner','admin'].includes(c.actor.role))fail('FORBIDDEN','An owner or service advisor records custody.',null,403)
 const job=find(c.s,'job',p.jobId);expectVersion(job,p.version)
 const signedBy=text(p.signedBy,'person acknowledging custody',200)
 if(p.consent!==true)fail('CUSTODY_CONSENT','Explicit consent to the exact checklist and electronic receipt is required.',null,400)
 const signature={name:signedBy,consent:CUSTODY_CONSENT,identityVerified:false,by:who(c),at:c.now}
 if(command==='intake.record'){
  const phase=choice(p.phase,['before','after'],'condition phase'),capturedAt=instant(p.capturedAt,'condition observation time')
  if(capturedAt>c.now)fail('INPUT','Condition observation cannot be in the future.',null,400)
  if(!Array.isArray(p.items)||p.items.length>50)fail('INPUT','List up to 50 custody items.',null,400)
  const items=p.items.map((x:any)=>({id:crypto.randomUUID(),kind:choice(x.kind,['key','accessory','valuable'],'custody item type'),label:text(x.label,'custody item',200),quantity:integer(x.quantity,'custody quantity',1,1000)}))
  const attachments=Array.isArray(p.attachments)?p.attachments:[]
  if(attachments.some((a:any)=>a.jobId!==job.id)||attachments.length>10)fail('INPUT','Use completed media from this visit.',null,400)
  const receipt=put(c.s,'intake',{n:rows(c.s,'intake').filter(i=>i.jobId===job.id).length+1,jobId:job.id,assetId:job.assetId,asset:structuredClone(job.asset),phase,capturedAt,damage:text(p.damage,'damage locations and condition',4000),items,attachments,lockHandling:text(p.lockHandling,'security-lock handling (no secrets)',1000),signature,by:who(c),at:c.now})
  bump(c.s,'job',job,{custodyRevision:(job.custodyRevision??0)+1});event(c,command,job.id,receipt.id,{phase});return receipt
 }
 const source=find(c.s,'intake',p.intakeId)
 if(source.jobId!==job.id||source.phase!=='before')fail('CUSTODY_SOURCE','Choose a before-condition receipt on this visit.')
 if(!Array.isArray(p.returned)||p.returned.length!==source.items.length)fail('CUSTODY_CHECKLIST','Compare every original custody item once.',null,400)
 const returned=source.items.map((item:any)=>{const matches=p.returned.filter((x:any)=>x.itemId===item.id);if(matches.length!==1)fail('CUSTODY_CHECKLIST','Compare every original custody item once.',null,400);const quantity=integer(matches[0].quantity,'returned quantity',0,item.quantity);return {...item,returnedQuantity:quantity,missingQuantity:item.quantity-quantity}})
 const discrepancy=text(p.discrepancy,'discrepancy explanation',2000,true)
 if(returned.some((x:any)=>x.missingQuantity)&&!discrepancy)fail('CUSTODY_DISCREPANCY','Explain every missing custody item.')
 const receipt=put(c.s,'intakeComparison',{jobId:job.id,assetId:job.assetId,intakeId:source.id,source:structuredClone(source),returned,discrepancy,signature,by:who(c),at:c.now,label:'Checklist comparison only; collection and payment are recorded separately.'})
 bump(c.s,'job',job,{custodyRevision:(job.custodyRevision??0)+1});event(c,command,job.id,receipt.id,{intakeId:source.id});return receipt
}
