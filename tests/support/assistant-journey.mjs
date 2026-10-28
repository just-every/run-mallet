import assert from 'node:assert/strict'
import {booking,archive,restore,installation} from '../harness.mjs'
export const grantInput=(kind,subjectId)=>({kind,subjectId,label:'synthetic-mallet-assistant',notBefore:new Date(Date.now()-60000).toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString(),spendCents:0,channel:kind==='send'?'email':'none',confirm:true,reason:'Owner explicitly permits this bounded assistant task'})
export const asKey=token=>({as:'',headers:{authorization:'Bearer '+token}})
export async function receptionistFixture(h){
 const owner=(await h.state()).actor.id,start=Date.now()+86400000
 const service=await h.command('booking.publish',{name:'Brake check',location:'Main shop',skill:'brakes',durationMinutes:30,leadMinutes:0,holdSeconds:1800,active:true,windows:[{startAt:new Date(start).toISOString(),endAt:new Date(start+3600000).toISOString(),bayId:'synthetic-mallet-bay',technicianId:owner,skills:['brakes']}]})
 const grant=await h.command('assistant.grant',grantInput('receptionist',service.id)),auth=asKey(grant.token),view=await h.api('/api/mallet/assistant',undefined,auth)
 const input={serviceId:service.id,slotId:view.slots[0].slotId,name:'synthetic-mallet-customer',email:'synthetic-mallet-customer@example.test',consent:true,aiDisclosed:true,request:'Customer requests a brake check, with human help available.',consentEvidence:'Customer explicitly requested this appointment after AI disclosure.'}
 return {service,grant,auth,input}
}
export async function assistantIntakeJourney(h){
 const f=await receptionistFixture(h)
 await h.command('assistant.intake',{...f.input,aiDisclosed:false},{...f.auth,status:422})
 await h.command('assistant.intake',{...f.input,serviceId:'other'},{...f.auth,status:403})
 await h.command('assistant.intake',{...f.input,spendCents:1},{...f.auth,status:403})
 await h.command('assistant.intake',{...f.input,channel:'sms'},{...f.auth,status:403})
 const result=await h.command('assistant.intake',f.input,f.auth)
 assert.equal(result.appointment.status,'held');assert.equal(result.appointment.name,f.input.name);assert.equal(result.appointment.email,f.input.email);assert.equal(result.intake.request,f.input.request);assert.match(result.intake.aiDisclosure,/AI receptionist/)
 const s=await h.state();assert.equal(s.records.appointment.length,1);assert.equal(s.records.job?.length??0,0);assert.equal(s.records.payment?.length??0,0)
 await h.command('assistant.intake',{...f.input,email:'other@example.test'},{...f.auth,status:409})
 const task=await h.command('assistant.escalate',{reason:'Customer asks for an advisor'},f.auth)
 assert.equal(task.resolution,null)
 const resolved=await h.command('assistant.resolve',{escalationId:task.id,version:task.version,reason:'Owner called the customer'})
 assert.equal(resolved.resolution.by.role,'owner');assert.equal(resolved.resolution.text,'Owner called the customer')
 return {f,...result}
}
export async function assistantAuthorityJourney(h){
 const f=await receptionistFixture(h),member=await h.person('synthetic-mallet-agent-member@example.test'),admin=await h.person('synthetic-mallet-agent-admin@example.test','admin')
 for(const as of [member.cookie,admin.cookie])await h.command('assistant.grant',grantInput('receptionist',f.service.id),{as,status:403})
 for(const input of [{...grantInput('receptionist',f.service.id),spendCents:1},{...grantInput('receptionist',f.service.id),channel:'sms'}])await h.command('assistant.grant',input,{status:input.spendCents?400:403})
 await h.api('/api/mallet/state',undefined,{...f.auth,status:403});await h.request('/app/settings/assistants',{...f.auth}).then(r=>assert.equal(r.status,403))
 // Assistant credentials retain their original door when the shop API is installed.
 for(const path of ['/api/mallet/v1/customers','/api/mallet/v1/repairs'])assert.equal((await h.api(path,undefined,{...f.auth,status:403})).error,'assistant_scope_required')
 assert.equal((await h.api('/api/mallet/v1/preparations',{command:'estimate.prepare',input:{}},{...f.auth,status:403})).error,'assistant_scope_required')
 for(const command of ['purchase.prepare','estimate.approve','invoice.export','agent.create','asset.create'])await h.command(command,{}, {...f.auth,status:403})
 const preparation=await h.command('agent.create',{label:'Original preparation key'})
 await h.command('assistant.intake',f.input,{...asKey(preparation.token),status:403})
 assert.equal((await h.state({as:admin.cookie})).records.assistantGrant,undefined)
 const revoked=await h.command('assistant.revoke',{grantId:f.grant.id,version:f.grant.version,reason:'Owner ends delegation'})
 assert.ok(revoked.revokedAt);await h.command('assistant.intake',f.input,{...f.auth,status:401})
 const future=await h.command('assistant.grant',{...grantInput('receptionist',f.service.id),notBefore:new Date(Date.now()+3600000).toISOString()})
 await h.api('/api/mallet/assistant',undefined,{...asKey(future.token),status:401})
 const db=await h.mf.getD1Database('DB');await db.prepare("UPDATE mallet_records SET value=json_set(value,'$.expiresAt','2000-01-01T00:00:00.000Z') WHERE kind='assistantGrant' AND id=?").bind(future.id).run()
 await h.api('/api/mallet/assistant',undefined,{...asKey(future.token),status:401})
}
export async function assistantNotesJourney(h){
 const {job,asset}=await booking(h),d=await h.command('diagnosis.record',{jobId:job.id,version:job.version,complaint:'  Brake   noise  at 40 mph. ',cause:'Measured signal at 12 mV.',measurements:[{name:'Rotor thickness',value:23.7,unit:'mm'}],dtcs:[{code:'C0035'}],testMethod:' Road   test '})
 const g=await h.command('assistant.grant',grantInput('polish',job.id)),auth=asKey(g.token),before=structuredClone((await h.state()).records.diagnosis)
 const edit=await h.command('assistant.polish',{diagnosisId:d.id,version:d.version},auth)
 assert.equal(edit.raw.complaint,'Brake   noise  at 40 mph.');assert.equal(edit.proposed.complaint,'Brake noise at 40 mph.');assert.deepEqual(edit.raw.measurements,[{name:'Rotor thickness',value:23.7,unit:'mm'}]);assert.deepEqual(edit.proposed.measurements,edit.raw.measurements);assert.deepEqual(edit.proposed.dtcs,edit.raw.dtcs);assert.match(edit.aiDisclosure,/AI/)
 const second=await h.command('assistant.polish',{diagnosisId:d.id,version:d.version,proposed:{complaint:'Brakes are noisy at 40 mph.'}},auth)
 assert.equal(second.proposed.complaint,'Brakes are noisy at 40 mph.');assert.equal(second.raw.complaint,edit.raw.complaint)
 for(const complaint of ['Brakes are noisy at 0 mph.','Brakes are noisy at 40 kph.','Brakes are quiet.'])await h.command('assistant.polish',{diagnosisId:d.id,version:d.version,proposed:{complaint}},{...auth,status:422})
 await h.command('assistant.polish',{diagnosisId:d.id,version:d.version,proposed:{cause:'Measured signal at 12 MV.'}},{...auth,status:422})
 const decision=await h.command('assistant.reviewEdit',{editId:second.id,version:second.version,decision:'approved',confirm:true,reason:'Owner checked wording against the exact raw observations'})
 assert.equal(decision.decision.value,'approved');assert.equal(decision.decision.by.role,'owner')
 assert.notEqual(second.id,edit.id);assert.equal((await h.state()).records.assistantEdit.length,2);assert.deepEqual((await h.state()).records.diagnosis,before)
 await h.command('assistant.polish',{diagnosisId:d.id,version:d.version,measurements:[{value:0}]},{...auth,status:422})
 const other=await booking(h,{asset:(await h.state()).records.asset.find(a=>a.id===asset.id),bayId:'Other bay',startAt:'2026-10-20T10:00:00Z',endAt:'2026-10-20T11:00:00Z'}),d2=await h.command('diagnosis.record',{jobId:other.job.id,version:other.job.version,complaint:'Other repair'})
 await h.command('assistant.polish',{diagnosisId:d2.id,version:d2.version},{...auth,status:403})
 const lines=await archive(h),fresh=await installation();try{await restore(fresh,lines);assert.deepEqual((await fresh.state()).records.assistantEdit,(await h.state()).records.assistantEdit);await fresh.api('/api/mallet/assistant',undefined,{...auth,status:401})}finally{await fresh.close()}
 return {g,edit}
}
export async function assistantSendJourney(h){
 const {f,appointment}=await assistantIntakeJourney(h),g=await h.command('assistant.grant',grantInput('send',appointment.id)),auth=asKey(g.token)
 let send=await h.command('assistant.queue',{},auth)
 assert.equal(send.to,appointment.email);assert.match(send.content,/AI receptionist/);assert.equal(send.status,'queued')
 await h.command('assistant.send',{sendId:send.id,version:send.version},{...auth,status:409})
 await h.command('assistant.review',{sendId:send.id,version:send.version,confirm:true,to:'wrong@example.test',content:send.content},{status:422})
 send=await h.command('assistant.review',{sendId:send.id,version:send.version,confirm:true,to:send.to,content:send.content})
 const mailCount=h.messages.length
 await h.command('assistant.revoke',{grantId:g.id,version:g.version,reason:'Owner revokes queued authority'})
 await h.command('assistant.send',{sendId:send.id,version:send.version},{...auth,status:401})
 assert.equal(h.messages.length,mailCount);assert.equal((await h.state()).records.assistantSend.find(x=>x.id===send.id).status,'stopped')
 const live=await h.command('assistant.grant',grantInput('send',appointment.id)),liveAuth=asKey(live.token)
 let approved=await h.command('assistant.queue',{},liveAuth);approved=await h.command('assistant.review',{sendId:approved.id,version:approved.version,confirm:true,to:approved.to,content:approved.content})
 const sent=await h.command('assistant.send',{sendId:approved.id,version:approved.version},liveAuth)
 assert.equal(sent.status,'accepted');assert.deepEqual(h.messages.at(-1).to,[appointment.email]);assert.equal(h.messages.at(-1).text,approved.content)
 await h.command('assistant.send',{sendId:sent.id,version:sent.version},{...liveAuth,status:409});assert.equal(h.messages.length,mailCount+1)
 const duplicate=await h.command('assistant.grant',grantInput('send',appointment.id));await h.command('assistant.queue',{}, {...asKey(duplicate.token),status:409})
 const lines=await archive(h),backup=JSON.stringify(lines);assert.ok(!backup.includes(live.token));assert.ok(!lines[0].tables.some(t=>t.name==='mallet_assistant_keys'))
 const fresh=await installation();try{await restore(fresh,lines);const recovered=await fresh.state();assert.deepEqual(recovered.records.assistantSend,(await h.state()).records.assistantSend);assert.equal(recovered.records.assistantIntake.length,1);await fresh.api('/api/mallet/assistant',undefined,{...liveAuth,status:401});await fresh.command('assistant.send',{sendId:sent.id,version:sent.version},{status:403})}finally{await fresh.close()}
}

export async function assistantFailureJourney(){
 for(const outcome of ['failed','uncertain']){
  let failing=false,calls=0
  const h=await installation({mailService:()=>{if(!failing)return Response.json({id:'synthetic-mallet-mail'});calls++;if(outcome==='uncertain')throw new Error('synthetic-mallet-interrupted-provider');return Response.json({error:'synthetic-mallet-refused'},{status:400})}})
  try{
   const f=await receptionistFixture(h);await h.command('assistant.intake',f.input,f.auth)
   const appointment=(await h.state()).records.appointment[0],grant=await h.command('assistant.grant',grantInput('send',appointment.id)),auth=asKey(grant.token)
   let send=await h.command('assistant.queue',{},auth);send=await h.command('assistant.review',{sendId:send.id,version:send.version,to:send.to,content:send.content,confirm:true})
   failing=true
   const result=await h.command('assistant.send',{sendId:send.id,version:send.version},auth)
   assert.equal(result.status,outcome);assert.equal(calls,1)
   await h.restart();await h.command('assistant.send',{sendId:result.id,version:result.version},{...auth,status:409});assert.equal(calls,1)
   const task=(await h.state()).records.assistantEscalation.find(t=>t.sendId===send.id);assert.ok(task);assert.equal(task.resolution,null)
   await h.command('assistant.resolve',{escalationId:task.id,version:task.version,reason:'Owner contacted customer; no resend'})
   await h.command('assistant.send',{sendId:result.id,version:result.version},{...auth,status:409});assert.equal(calls,1)
  }finally{await h.close()}
 }
}
