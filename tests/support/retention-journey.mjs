import assert from 'node:assert/strict'
import {createHash,randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {archive,restore,installation,booking,estimate,authorise} from '../harness.mjs'
import {custodyMedia} from './intake-journey.mjs'
import {qualityReady} from './quality-ready.mjs'

const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
export async function completedInvoice(h,asset,startAt,endAt){
 let {job}=await booking(h,{asset,startAt,endAt}),quote=await authorise(h,await estimate(h,job))
 for(const line of quote.revisions[0].lines){job=(await h.state()).records.job.find(j=>j.id===job.id);await h.command('work.record',{jobId:job.id,version:job.version,lineId:line.id,quantity:line.quantity})}
 job=(await h.state()).records.job.find(j=>j.id===job.id);await qualityReady(h,job)
 job=await h.command('job.complete',{jobId:job.id,version:job.version})
 let invoice=await h.command('invoice.prepare',{jobId:job.id,version:job.version});invoice=await h.command('invoice.approve',{invoiceId:invoice.id,version:invoice.version})
 const exported=await h.command('invoice.export',{invoiceId:invoice.id,version:invoice.version})
 return {job,invoice,exported,csv:await(await h.request('/api/mallet/exports/'+exported.id)).text()}
}
async function previewAndRun(h,customerId,{mode='erase',categories=['media'],...overrides}={}){
 const input={customerId,mode,categories},preview=await h.command('retention.preview',input)
 const receipt=await h.command(mode==='erase'?'customer.erase':'retention.run',{customerId,categories,fingerprint:preview.fingerprint,consent:true,confirm:mode==='erase'?'ERASE':'RUN RETENTION',reason:'synthetic-mallet-18',consentEvidence:'synthetic-mallet-19',...overrides})
 return {preview,receipt}
}

/** GOV-006 public command journey, including real import-kit custody, native
 * chunk storage, external unlock keys and native portability restore doors. */
export async function retentionJourney(h){
 const input={customers:{customers:[{id:27001,fullname:'synthetic-mallet-1',email:'synthetic-mallet-2@example.test'}]},assets:{assets:[{id:27002,customer_id:27001,name:'synthetic-mallet-3',asset_serial:'synthetic-mallet-4'}]}}
 const review=await h.api('/api/mallet/imports/preview',input),imported=await h.api('/api/mallet/imports/apply',{...input,fingerprint:review.fingerprint})
 assert.equal(imported.state,'completed')
 const contact=await h.command('contact.save',{name:'synthetic-mallet-1',email:'synthetic-mallet-2@example.test',phone:'',communication:'none',notes:'synthetic-mallet-5'})
 const account=await h.command('customer.save',{name:'synthetic-mallet-1',kind:'person',contactIds:[contact.id],payerId:contact.id,billingContactId:contact.id,taxStatus:'unknown',notes:'synthetic-mallet-6'})
 let asset=(await h.state()).records.asset.find(a=>a.identifier==='synthetic-mallet-4')
 asset=await h.command('customer.linkAsset',{assetId:asset.id,version:asset.version,customerId:account.id,customerVersion:account.version,reason:'synthetic-mallet-7'})
 const first=await completedInvoice(h,asset,'2026-10-01T08:00:00Z','2026-10-01T09:00:00Z')
 asset=(await h.state()).records.asset.find(a=>a.id===asset.id)
 const second=await completedInvoice(h,asset,'2026-10-02T08:00:00Z','2026-10-02T09:00:00Z')
 const bytes=await readFile('tests/fixtures/dvi/front-brake.png'),photo=await custodyMedia(h,first.job,bytes,'synthetic-mallet-8.png','image/png','synthetic-mallet-9'),heldPhoto=await custodyMedia(h,second.job,bytes,'synthetic-mallet-10.png','image/png','synthetic-mallet-11')
 const shared=await h.api('/api/mallet/media/uploads',{findingId:photo.findingId,clientId:randomUUID(),variant:'shared',originalId:photo.id,filename:'synthetic-mallet-12.png',mime:'image/png',size:bytes.length,sha256:sha(bytes),capturedAt:photo.capturedAt,annotations:{text:'synthetic-mallet-13'}})
 for(let ordinal=0;ordinal<Math.ceil(bytes.length/65536);ordinal++){const chunk=bytes.subarray(ordinal*65536,(ordinal+1)*65536);await h.api('/api/mallet/media/uploads/'+shared.id+'/chunks/'+ordinal,{base64:chunk.toString('base64'),sha256:sha(chunk)},{method:'PUT'})}
 await h.api('/api/mallet/media/uploads/'+shared.id+'/complete',{})
 const finding=await h.api('/api/mallet/media/findings',{jobId:first.job.id,clientId:randomUUID(),title:'synthetic-mallet-14',capturedAt:new Date(Date.now()-1000).toISOString(),observation:{measurements:[],recommendation:'synthetic-mallet-15',provenance:{kind:'native'}}})
 const incomplete=await h.api('/api/mallet/media/uploads',{findingId:finding.id,clientId:randomUUID(),variant:'original',filename:'synthetic-mallet-16.png',mime:'image/png',size:bytes.length,sha256:sha(bytes),capturedAt:finding.capturedAt})
 const firstChunk=bytes.subarray(0,65536);await h.api('/api/mallet/media/uploads/'+incomplete.id+'/chunks/0',{base64:firstChunk.toString('base64'),sha256:sha(firstChunk)},{method:'PUT'})
 const secret='synthetic-mallet-17',vault=await h.command('intake.secretStore',{jobId:first.job.id,secret,purpose:'synthetic-mallet-20',consent:true,expiresAt:new Date(Date.now()+600000).toISOString()})
 const db=await h.mf.getD1Database('DB'),keyBucket=await h.mf.getR2Bucket('INTAKE_VAULT'),cipher=await db.prepare('SELECT * FROM mallet_intake_secrets WHERE id=?').bind(vault.id).first()
 assert.ok(await keyBucket.get('unlock-keys/'+vault.id))
 const financial=await h.command('retention.hold',{customerId:account.id,scope:'financial',reason:'synthetic-mallet-21',caseReference:'synthetic-mallet-22'})
 const mediaHold=await h.command('retention.hold',{customerId:account.id,jobId:second.job.id,scope:'media',reason:'synthetic-mallet-23',caseReference:'synthetic-mallet-24'})
 const admin=await h.person('synthetic-mallet-25@example.test','admin')
 for(const command of ['retention.preview','retention.policy','retention.hold','retention.release','customer.export','customer.erase','retention.run'])await h.command(command,{customerId:account.id},{as:admin.cookie,status:403})
 const before=await h.state(),old=await archive(h),exported=await h.command('customer.export',{customerId:account.id})
 assert.ok(exported.media.chunks.length>0);assert.ok(exported.imports.length>0);assert.ok(!JSON.stringify(exported).includes(secret));assert.ok(!('mallet_intake_secrets' in exported))
 const planned=await h.command('retention.preview',{customerId:account.id,categories:['media']})
 await h.command('customer.erase',{customerId:account.id,categories:['media'],fingerprint:planned.fingerprint,reason:'synthetic-mallet-26',consentEvidence:'synthetic-mallet-27',consent:false,confirm:'ERASE'},{status:400})
 assert.ok(await keyBucket.get('unlock-keys/'+vault.id),'Refused consent leaves keys and media unchanged')
 await h.command('customer.erase',{customerId:account.id,categories:['media'],fingerprint:planned.fingerprint,reason:secret,consentEvidence:'synthetic-mallet-27',consent:true,confirm:'ERASE'},{status:400})
 await h.command('retention.hold',{customerId:account.id,scope:'financial',reason:'synthetic-mallet-34',caseReference:'synthetic-mallet-35'})
 await h.command('customer.erase',{customerId:account.id,categories:['media'],fingerprint:planned.fingerprint,reason:'synthetic-mallet-26',consentEvidence:'synthetic-mallet-27',consent:true,confirm:'ERASE'},{status:409})
 const {preview,receipt}=await previewAndRun(h,account.id)
 assert.equal(receipt.phase,'complete');assert.equal(receipt.counts.uploads,3);assert.equal(receipt.counts.incompleteUploads,1);assert.equal(receipt.counts.findings,2);assert.equal(receipt.counts.unlockKeys,1);assert.ok(preview.held.some(x=>x.id===financial.id));assert.ok(preview.held.some(x=>x.id===mediaHold.id))
 assert.equal(await keyBucket.get('unlock-keys/'+vault.id),null)
 for(const media of [photo,shared,incomplete])assert.equal((await h.request('/api/mallet/media/uploads/'+media.id+'/content')).status,404)
 assert.equal((await h.request(heldPhoto.contentUrl)).status,200,'Explicit media hold retains private bytes')
 assert.equal((await h.api('/api/mallet/media/findings?jobId='+first.job.id)).findings.length,0)
 assert.equal((await db.prepare('SELECT count(*) AS n FROM mallet_media_chunks WHERE upload_id IN (?,?,?)').bind(photo.id,shared.id,incomplete.id).first()).n,0)
 const after=await h.state();for(const kind of ['invoice','estimate','approval','export','payment'])assert.deepEqual(after.records[kind],before.records[kind],'Financial/authorization '+kind+' remains exact')
 assert.equal(await(await h.request('/api/mallet/exports/'+first.exported.id)).text(),first.csv)
 // Restoring D1 alone cannot reconstruct a destroyed external data key.
 await db.prepare('INSERT INTO mallet_intake_secrets(id,job_id,purpose,expires_at,cipher,iv) VALUES(?,?,?,?,?,?)').bind(...['id','job_id','purpose','expires_at','cipher','iv'].map(k=>cipher[k])).run()
 await h.command('intake.secretReveal',{jobId:first.job.id,secretId:vault.id,reason:'synthetic-mallet-28'},{status:404})
 const postErase=await archive(h)
 const stale=await installation({bindings:{OWNER_EMAIL:'synthetic-mallet-29@example.test'}})
 try{const refused=await restore(stale,old,{laterJournal:{sourceIdentity:postErase[0].sourceIdentity,epoch:postErase[0].epoch,journal:postErase[0].journal},status:400});assert.equal(refused.error,'erasure_epoch')}finally{await stale.close()}
 const fresh=await installation({bindings:{OWNER_EMAIL:'synthetic-mallet-30@example.test'}})
 try{await restore(fresh,postErase);assert.equal((await fresh.request(photo.contentUrl)).status,404);assert.equal((await fresh.request(heldPhoto.contentUrl)).status,200);assert.ok((await fresh.state()).records.retentionHold.some(h=>h.id===mediaHold.id));assert.ok((await fresh.state()).records.retentionReceipt.some(r=>r.id===receipt.id));assert.equal(await(await fresh.request('/api/mallet/exports/'+first.exported.id)).text(),first.csv)}finally{await fresh.close()}
 const policy=await h.command('retention.policy',{version:0,mediaDays:0,personalDays:null,consent:true,reason:'synthetic-mallet-31'})
 assert.equal(policy.mode,'manual');assert.equal((await h.command('retention.preview',{customerId:account.id,mode:'retention',categories:['media']})).counts.uploads,0)
 await h.command('retention.release',{holdId:mediaHold.id,version:mediaHold.version,consent:true,reason:'synthetic-mallet-32'})
 const retained=await previewAndRun(h,account.id,{mode:'retention'})
 assert.equal(retained.receipt.counts.uploads,1);assert.equal((await h.request(heldPhoto.contentUrl)).status,404)
 const personal=await previewAndRun(h,account.id,{categories:['personal','import']})
 assert.ok(personal.receipt.importReceipts.length>0)
 const journal=await h.api('/api/mallet/imports/journal?id='+imported.id)
 assert.ok(journal.originals.every(o=>o.original.status!=='retained'),'Affected exact source artifacts are withdrawn, never rewritten')
 assert.ok(!JSON.stringify(journal).includes('synthetic-mallet-2@example.test'))
 const final=await archive(h),finalDb=await h.mf.getD1Database('DB')
 assert.equal((await finalDb.prepare('SELECT count(*) AS n FROM mallet_media_chunks').first()).n,0)
 const recovered=await installation({bindings:{OWNER_EMAIL:'synthetic-mallet-33@example.test'}})
 try{await restore(recovered,final);assert.equal((await recovered.request(photo.contentUrl)).status,404);assert.equal((await recovered.state()).records.contact.find(c=>c.id===contact.id).email,'');assert.deepEqual((await recovered.state()).records.invoice,(await h.state()).records.invoice);assert.equal((await restore(recovered,old,{status:400})).error,'erasure_epoch')}finally{await recovered.close()}
 return {account,first,second,financial,mediaHold,receipt,retentionReceipt:retained.receipt,personalReceipt:personal.receipt}
}
