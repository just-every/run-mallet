import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createHash,randomUUID} from 'node:crypto'
import {booking,archive,restore,installation} from '../harness.mjs'
export async function custodyMedia(h,job,bytes,filename='condition.png',mime='image/png',title='Before condition — left door dent'){
 const hash=b=>createHash('sha256').update(b).digest('hex')
 const finding=await h.api('/api/mallet/media/findings',{jobId:job.id,clientId:randomUUID(),title,capturedAt:new Date(Date.now()-1000).toISOString()})
 let upload=await h.api('/api/mallet/media/uploads',{findingId:finding.id,clientId:randomUUID(),variant:'original',filename,mime,size:bytes.length,sha256:hash(bytes),capturedAt:finding.capturedAt})
 for(let i=0;i<Math.ceil(bytes.length/65536);i++){const part=bytes.subarray(i*65536,(i+1)*65536);await h.api('/api/mallet/media/uploads/'+upload.id+'/chunks/'+i,{base64:part.toString('base64'),sha256:hash(part)},{method:'PUT'})}
 return h.api('/api/mallet/media/uploads/'+upload.id+'/complete',{})
}
export async function custodyPhoto(h,job){return custodyMedia(h,job,await readFile('tests/fixtures/dvi/front-brake.png'))}
export const custodyInput=job=>({jobId:job.id,version:job.version,phase:'before',capturedAt:new Date(Date.now()-1000).toISOString(),damage:'Left front door dent at lower edge; screen uncracked',items:[{kind:'key',label:'Spare key',quantity:1},{kind:'accessory',label:'Charger',quantity:1},{kind:'valuable',label:'Glovebox wallet',quantity:1}],lockHandling:'Customer unlocks in person; any temporary code held only in owner vault',signedBy:'Dana Brooks',consent:true})
export async function intakeJourney(h){
 let {job}=await booking(h);const other=await booking(h,{asset:await h.command('asset.create',{customerName:'Other customer',label:'Other device',identifier:'synthetic-mallet-72'}),bayId:'Bay 2',technicianId:'Counter 2'}),photo=await custodyPhoto(h,job),alien=await custodyPhoto(h,other.job)
 const input={...custodyInput(job),attachmentIds:[photo.id]}
 await h.command('intake.record',input,{as:'',status:401})
 const member=await h.person('custody-tech@example.test'),admin=await h.person('custody-advisor@example.test','admin')
 await h.command('intake.record',input,{as:member.cookie,status:403})
 await h.command('intake.record',input,{headers:{origin:'https://other.test'},status:403})
 await h.command('intake.record',{...input,consent:false},{status:400})
 await h.command('intake.record',{...input,attachmentIds:[alien.id]},{status:400})
 const before=await h.command('intake.record',input,{as:admin.cookie});assert.equal(before.attachments[0].sha256,photo.sha256);assert.equal(before.signature.identityVerified,false);assert.equal(before.assetId,job.assetId)
 await h.command('intake.record',input,{status:409});job=(await h.state()).records.job.find(j=>j.id===job.id)
 const afterPhoto=await custodyPhoto(h,job),after=await h.command('intake.record',{...input,attachmentIds:[afterPhoto.id],version:job.version,phase:'after',damage:'Door dent unchanged; repair area clean'});assert.notEqual(after.attachments[0].id,before.attachments[0].id);assert.equal(after.phase,'after')
 job=(await h.state()).records.job.find(j=>j.id===job.id)
 const compare={jobId:job.id,version:job.version,intakeId:before.id,returned:before.items.map(i=>({itemId:i.id,quantity:i.quantity})),signedBy:'Dana Brooks',consent:true}
 await h.command('intake.compare',{...compare,returned:compare.returned.slice(1)},{status:400})
 await h.command('intake.compare',{...compare,returned:compare.returned.map((x,i)=>({...x,quantity:i===0?0:x.quantity}))},{status:409})
 const comparison=await h.command('intake.compare',compare);assert.ok(comparison.returned.every(i=>i.missingQuantity===0));assert.equal(comparison.source.id,before.id);assert.equal(comparison.signature.name,'Dana Brooks')
 const secret='synthetic-mallet-71',store={jobId:job.id,purpose:'Unlock only for diagnosis',secret,expiresAt:new Date(Date.now()+600000).toISOString(),consent:true}
 await h.command('intake.secretStore',store,{as:admin.cookie,status:403});await h.command('intake.secretStore',{...store,consent:false},{status:400})
 await h.command('intake.secretStore',{...store,expiresAt:new Date(Date.now()+86401000).toISOString()},{status:400})
 const vault=await h.command('intake.secretStore',store);assert.equal('secret' in vault,false)
 const key=await h.command('agent.create',{label:'No custody authority'})
 const bearer={as:'',headers:{authorization:'Bearer '+key.token}}
 await h.command('intake.secretReveal',{jobId:job.id,secretId:vault.id,reason:'Diagnosis'},{...bearer,status:403})
 assert.equal((await h.state(bearer)).records.intake?.length??0,0)
 const revealed=await h.command('intake.secretReveal',{jobId:job.id,secretId:vault.id,reason:'Diagnosis requires unlock'});assert.equal(revealed.secret,secret)
 assert.ok(!JSON.stringify(await h.state()).includes(secret),'Unlock material never reaches general state or audit')
 const wrongJob={jobId:other.job.id,secretId:vault.id,reason:'Wrong job'};await h.command('intake.secretReveal',wrongJob,{status:404})
 const saved=await h.state(),backup=await archive(h);assert.ok(!JSON.stringify(backup).includes(secret));assert.ok(backup[0].excludedTables.includes('mallet_intake_secrets'));assert.ok(!backup[0].tables.some(t=>t.name==='mallet_intake_secrets'))
 const fresh=await installation({bindings:{OWNER_EMAIL:'custody-recovery@example.test'}})
 try{await restore(fresh,backup);const restored=await fresh.state();for(const kind of ['intake','intakeComparison','intakeSecretAudit'])assert.deepEqual(restored.records[kind],saved.records[kind]);assert.deepEqual(Buffer.from(await(await fresh.request(photo.contentUrl)).arrayBuffer()),await readFile('tests/fixtures/dvi/front-brake.png'));await fresh.command('intake.secretReveal',{jobId:job.id,secretId:vault.id,reason:'Restore cannot bring secrets'},{status:404});await fresh.state({as:h.owner,status:401})}finally{await fresh.close()}
 await h.command('intake.secretEnd',{jobId:job.id,secretId:vault.id});await h.command('intake.secretReveal',{jobId:job.id,secretId:vault.id,reason:'Purpose ended'},{status:404})
 const expiring=await h.command('intake.secretStore',{...store,expiresAt:new Date(Date.now()+600000).toISOString()});await h.cron(new Date(Date.now()+700000).toISOString());await h.command('intake.secretReveal',{jobId:job.id,secretId:expiring.id,reason:'Expired'},{status:404})
 assert.equal((await h.state()).records.flow?.find(f=>f.jobId===job.id)?.collection??null,null,'Checklist comparisons never release a repair')
 return {job,before,after,comparison}
}
