import {bump,event,expectVersion,fail,find,integer,put,rows,text,who,type Context,type Handler,type Row,type State} from './model'
import {bookings,bookingSlots,bookingSlotId} from './bookings'
import {instant} from './workshop'
export const assistantCommands=['assistant.grant','assistant.revoke','assistant.intake','assistant.polish','assistant.queue','assistant.review','assistant.reviewEdit','assistant.claim','assistant.outcome','assistant.escalate','assistant.resolve']
const agentActions=['assistant.intake','assistant.polish','assistant.queue','assistant.claim','assistant.outcome','assistant.escalate']
export function currentGrant(s:State,id:string,now:string){
 const g=find(s,'assistantGrant',id)
 if(g.revokedAt||g.notBefore>now||g.expiresAt<=now)fail('ASSISTANT_GRANT','This grant is revoked, expired or not yet active.',null,403)
 return g
}
const owner=(c:Context)=>{if(c.actor.role!=='owner')fail('FORBIDDEN','Only the current owner manages expanded agent authority.',null,403)}
const stamp=(c:Context)=>({by:who(c),at:c.now})
export const assistant:Handler=(c,command,p)=>{
 if(!assistantCommands.includes(command))return
 if(command==='assistant.grant'){
  owner(c)
  if(p.confirm!==true)fail('ASSISTANT_CONFIRM','Explicitly confirm these exact rights.',null,422)
  const kind=text(p.kind,'grant kind'),subjectId=text(p.subjectId,'allowed data subject')
  const source=kind==='receptionist'?'bookingService':kind==='polish'?'job':kind==='send'?'appointment':''
  if(!source)fail('INPUT','Choose receptionist, polish or send.',null,400)
  find(c.s,source,subjectId)
  const notBefore=instant(p.notBefore,'authority starts'),expiresAt=instant(p.expiresAt,'authority expires')
  if(expiresAt<=notBefore||expiresAt<=c.now||Date.parse(expiresAt)-Date.parse(c.now)>31*86400000)fail('ASSISTANT_TIME','Grant at most 31 days of authority.')
  const spendCents=integer(p.spendCents,'spend limit',0,0),channel=text(p.channel,'channel')
  if(channel!==(kind==='send'?'email':'none'))fail('ASSISTANT_CHANNEL','This grant permits only its declared channel.',null,403)
  const row=put(c.s,'assistantGrant',{kind,subjectId,label:text(p.label,'assistant label',100),notBefore,expiresAt,spendCents,channel,revokedAt:null,...stamp(c),policy:'owner-scoped-v1',reason:text(p.reason,'grant reason',1000)})
  event(c,command,null,row.id,{kind,subjectId});return row
 }
 if(command==='assistant.revoke'){
  owner(c);const g=find(c.s,'assistantGrant',p.grantId);expectVersion(g,p.version)
  const row=bump(c.s,'assistantGrant',g,{revokedAt:c.now,revokedBy:who(c),revocationReason:text(p.reason,'revocation reason',1000)})
  for(const send of rows(c.s,'assistantSend').filter(x=>x.grantId===g.id&&['queued','reviewed'].includes(x.status)))bump(c.s,'assistantSend',send,{status:'stopped',stoppedAt:c.now,stopReason:'grant revoked'})
  event(c,command,null,g.id,{});return row
 }
 if(command==='assistant.review'){
  owner(c);const send=find(c.s,'assistantSend',p.sendId);expectVersion(send,p.version)
  const g=currentGrant(c.s,send.grantId,c.now),a=find(c.s,'appointment',g.subjectId)
  if(send.status!=='queued'||a.version!==send.appointmentVersion||a.status!=='held'||a.expiresAt<=c.now||a.email!==send.to)fail('ASSISTANT_STALE','The requested appointment or message changed.')
  if(p.confirm!==true||p.content!==send.content||p.to!==send.to)fail('ASSISTANT_REVIEW','Review the exact recipient and message before approving.',null,422)
  return bump(c.s,'assistantSend',send,{status:'reviewed',review:{...stamp(c),content:send.content,to:send.to,grantVersion:g.version}})
 }
 if(command==='assistant.reviewEdit'){
  owner(c);const edit=find(c.s,'assistantEdit',p.editId);expectVersion(edit,p.version)
  currentGrant(c.s,edit.grantId,c.now)
  const source=find(c.s,'diagnosis',edit.diagnosisId)
  if(edit.decision||source.version!==edit.sourceVersion)fail('ASSISTANT_STALE','This proposal was decided or its technician source changed.')
  if(p.confirm!==true||!['approved','rejected'].includes(p.decision))fail('ASSISTANT_REVIEW','Explicitly decide this exact note proposal.',null,422)
  return bump(c.s,'assistantEdit',edit,{decision:{value:p.decision,reason:text(p.reason,'review reason',1000),...stamp(c)}})
 }
 if(command==='assistant.resolve'){
  owner(c);const task=find(c.s,'assistantEscalation',p.escalationId);expectVersion(task,p.version)
  if(task.resolution)fail('ASSISTANT_RESOLVED','This escalation is already resolved.')
  return bump(c.s,'assistantEscalation',task,{resolution:{text:text(p.reason,'human resolution',2000),...stamp(c)}})
 }
 if(c.actor.role!=='agent'||!c.actor.assistantGrantId||!agentActions.includes(command))fail('FORBIDDEN','Use a separate policy-scoped assistant key.',null,403)
 const g=currentGrant(c.s,c.actor.assistantGrantId,c.now)
 if(p.spendCents!==undefined&&p.spendCents!==0||p.channel!==undefined&&p.channel!==g.channel)fail('ASSISTANT_POLICY','This action exceeds the zero-spend or channel policy.',null,403)
 if(command==='assistant.escalate')return put(c.s,'assistantEscalation',{grantId:g.id,subjectId:g.subjectId,reason:text(p.reason,'reason for human help',2000),resolution:null,...stamp(c)})
 if(command==='assistant.intake'){
  if(g.kind!=='receptionist'||p.serviceId!==g.subjectId)fail('ASSISTANT_SCOPE','This grant covers one booking service only.',null,403)
  if(p.aiDisclosed!==true||p.consent!==true)fail('ASSISTANT_DISCLOSURE','Disclose the AI receptionist and record the customer appointment request.',null,422)
  const held=bookings(c,'booking.hold',{...p,sourceHash:g.id,consent:true}) as Row
  const intake=put(c.s,'assistantIntake',{grantId:g.id,appointmentId:held.id,request:text(p.request,'customer request',2000),aiDisclosure:'You are interacting with an AI receptionist. A person can help; no repairs or payments are authorized.',consentEvidence:text(p.consentEvidence,'customer request evidence',2000),...stamp(c)})
  return {intake,appointment:held}
 }
 if(command==='assistant.polish'){
  if(g.kind!=='polish')fail('ASSISTANT_SCOPE','Use a note-polishing grant.',null,403)
  const d=find(c.s,'diagnosis',p.diagnosisId)
  if(d.jobId!==g.subjectId)fail('ASSISTANT_SCOPE','This diagnosis belongs to another repair.',null,403)
  expectVersion(d,p.version)
  const fields=['complaint','cause','correction','staffNote','customerExplanation','testMethod']
  if(p.measurements!==undefined||p.dtcs!==undefined||p.proposed!==undefined&&(!p.proposed||Array.isArray(p.proposed)||typeof p.proposed!=='object'||Object.keys(p.proposed).some(key=>!fields.includes(key))))fail('ASSISTANT_FACTS','Measured facts and source metadata cannot be edited.',null,422)
  const raw=structuredClone(d.revisions.at(-1)),proposed=structuredClone(raw)
  // Preserve each numeric observation together with its written unit, and each trouble code.
  // Ambiguous rewrites need human escalation; structured measurements are never caller supplied.
  const facts=(value:string)=>(value.match(/[PBCU][0-3][0-9A-F]{3}|[+-]?\d+(?:\.\d+)?(?:[ \t]*[a-z%°]+)?/gi)??[]).map(x=>x.replace(/\s/g,''))
  for(const field of fields)if(typeof raw[field]==='string'){
   proposed[field]=p.proposed?.[field]===undefined?raw[field].replace(/\s+/g,' ').trim():text(p.proposed[field],field,4000,true)
   if(JSON.stringify(facts(raw[field]))!==JSON.stringify(facts(proposed[field])))fail('ASSISTANT_FACTS','A proposed note must preserve numeric observations, units and trouble codes; escalate uncertain changes.',null,422)
  }
  return put(c.s,'assistantEdit',{grantId:g.id,jobId:d.jobId,diagnosisId:d.id,sourceVersion:d.version,raw,proposed,decision:null,aiDisclosure:'AI note-polishing proposal; raw technician evidence remains authoritative. A person must review the wording.',...stamp(c)})
 }
 if(command==='assistant.queue'){
  if(g.kind!=='send'||g.channel!=='email')fail('ASSISTANT_SCOPE','Use a reviewed email grant.',null,403)
  const a=find(c.s,'appointment',g.subjectId)
  if(a.status!=='held'||a.expiresAt<=c.now)fail('ASSISTANT_STALE','Only the current requested tentative appointment may receive this message.')
  if(rows(c.s,'assistantSend').some(x=>x.grantId===g.id||x.appointmentId===a.id&&x.status!=='stopped'))fail('ASSISTANT_ONCE','This requested appointment already has a queued or attempted confirmation; a new grant cannot create another.')
  const content=`AI receptionist, reviewed by the shop: ${a.name}, your requested tentative ${a.service.name} slot is reserved from ${a.startAt} to ${a.endAt} (${a.service.timeZone}). It expires at ${a.expiresAt}. Contact the shop for human help. This does not authorize repairs or payment.`
  return put(c.s,'assistantSend',{grantId:g.id,appointmentId:a.id,appointmentVersion:a.version,to:a.email,content,channel:'email',spendCents:0,status:'queued',...stamp(c)})
 }
 const send=find(c.s,'assistantSend',p.sendId);expectVersion(send,p.version)
 if(g.kind!=='send'||send.grantId!==g.id)fail('ASSISTANT_SCOPE','This message belongs to another grant.',null,403)
 if(command==='assistant.claim'){
  const a=find(c.s,'appointment',g.subjectId)
  if(rows(c.s,'assistantSend').some(x=>x.id!==send.id&&x.appointmentId===send.appointmentId&&['claimed','accepted','development','failed','uncertain'].includes(x.status)))fail('ASSISTANT_ONCE','This requested appointment already had its one handoff attempt.')
  if(send.status!=='reviewed'||send.review.grantVersion!==g.version||a.version!==send.appointmentVersion||a.status!=='held'||a.expiresAt<=c.now||a.email!==send.to)fail('ASSISTANT_STALE','Review and current appointment eligibility are required.')
  return bump(c.s,'assistantSend',send,{status:'claimed',claimedAt:c.now})
 }
 if(send.status!=='claimed'||!['accepted','development','failed','uncertain'].includes(p.status))fail('ASSISTANT_OUTCOME','Only the claimed message can record one outcome.')
 const outcome=bump(c.s,'assistantSend',send,{status:p.status,providerReference:p.providerReference??null,outcomeAt:c.now})
 if(['failed','uncertain'].includes(p.status))put(c.s,'assistantEscalation',{grantId:g.id,subjectId:g.subjectId,sendId:send.id,reason:'Appointment email '+p.status+'. A person must resolve this; no automatic retry is permitted.',resolution:null,...stamp(c)})
 return outcome
}
export function assistantView(s:State,g:Row,now:string){
 const common={grant:g,disclosure:'You are interacting with an AI assistant. Ask a person for help at any time.',escalations:rows(s,'assistantEscalation').filter(e=>e.grantId===g.id)}
 if(g.kind==='receptionist'){const service=find(s,'bookingService',g.subjectId);return {...common,service,slots:bookingSlots(s,service,now).map(slot=>({...slot,slotId:bookingSlotId(service,slot)})),intakes:rows(s,'assistantIntake').filter(i=>i.grantId===g.id)}}
 if(g.kind==='polish')return {...common,diagnoses:rows(s,'diagnosis').filter(d=>d.jobId===g.subjectId),edits:rows(s,'assistantEdit').filter(e=>e.grantId===g.id)}
 return {...common,appointment:find(s,'appointment',g.subjectId),sends:rows(s,'assistantSend').filter(e=>e.grantId===g.id)}
}
