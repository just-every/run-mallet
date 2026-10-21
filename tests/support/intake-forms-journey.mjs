import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {booking,archive,restore,installation} from '../harness.mjs'
import {shopSetup} from './diagnosis-journey.mjs'
export const templateInput=(kind='vehicle')=>({name:kind==='vehicle'?'Vehicle intake':'Device intake',kind,diagnosticFeeCents:7500,storageTerms:'Storage $10/day after three days; contact the shop before charges.',teardownTerms:'Diagnosis only; teardown needs separate permission.',fields:[{key:'concern',label:kind==='vehicle'?'When does the noise happen?':'Does the device power on?',required:true},{key:'notes',label:'Other details',required:false}]})
export async function formPost(h,url,fields,{status=200,origin=h.origin}={}){
 const response=await h.mf.dispatchFetch(url,{method:'POST',headers:{origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(fields)});const html=await response.text();assert.equal(response.status,status,html.slice(0,200));return html
}
export async function intakeFormsJourney(h){
 await shopSetup(h);const a=await h.command('intakeForm.publish',templateInput()),b=await h.command('intakeForm.publish',templateInput('device')),{job}=await booking(h),member=await h.person('forms-tech@example.test'),agent=await h.command('agent.create',{label:'No intake forms'}),bearer={as:'',headers:{authorization:'Bearer '+agent.token}}
 for(const options of [{as:member.cookie,status:403},{...bearer,status:403},{as:'',status:401},{headers:{origin:'https://other.test'},status:403}])await h.command('intakeForm.publish',templateInput(),options)
 const link=await h.command('intakeForm.create',{jobId:job.id,version:job.version,templateId:a.id,templateVersion:a.version}),request=url=>h.mf.dispatchFetch(url,{headers:{origin:h.origin}})
 const empty=await request(link.url);assert.equal(empty.status,200);assert.equal(empty.headers.get('cache-control'),'no-store');assert.ok((await empty.text()).includes('Vehicle intake'))
 await formPost(h,link.url,{version:link.version,symptom:'Brake squeal',typedName:'Dana Brooks',action:'sign',consent:'yes'},{status:403,origin:'https://other.test'})
 await h.command('intakeForm.customerSave',{formId:link.id,version:link.version,answers:{symptom:'forged'},sign:true},{status:404})
 let html=await formPost(h,link.url,{version:link.version,symptom:'Brake squeal on cold mornings',typedName:'Dana Brooks',action:'sign',consent:'yes'},{status:422});assert.ok(html.includes('Your draft was saved'));assert.ok(html.includes('Brake squeal on cold mornings'));let row=(await h.state()).records.intakeForm.find(f=>f.id===link.id);assert.equal(row.status,'draft');assert.equal(row.answers.symptom,'Brake squeal on cold mornings');assert.equal(row.receipt,null)
 const fields={version:row.version,symptom:row.answers.symptom,concern:'Only on the first stop',notes:'Customer entered on phone',typedName:'Dana Brooks',action:'sign',consent:'yes'}
 html=await formPost(h,link.url,fields);assert.ok(html.includes('Signed intake copy'));assert.ok(html.includes('Copy handed to the mail provider'))
 row=(await h.state()).records.intakeForm.find(f=>f.id===link.id);assert.equal(row.status,'signed');assert.equal(row.receipt.template.n,1);assert.equal(row.receipt.template.diagnosticFeeCents,7500);assert.equal(row.receipt.signature.identityVerified,false);assert.equal(row.copy.status,'accepted');assert.equal('by' in row.receipt.template,false)
 const {sha256,...canonical}=row.receipt;assert.equal(sha256,createHash('sha256').update(JSON.stringify(canonical)).digest('hex'))
 const mail=h.messages.find(m=>m.subject==='Your signed shop intake copy');assert.deepEqual(mail.to,[job.asset.customerEmail]);assert.deepEqual(JSON.parse(mail.text.split('\n\n').slice(1).join('\n\n')),row.receipt);assert.ok(mail.html.includes('Only on the first stop'));const sends=h.messages.length
 await formPost(h,link.url,{...fields,symptom:'Cannot replace signed content'});assert.equal(h.messages.length,sends);assert.deepEqual((await h.state()).records.intakeForm.find(f=>f.id===link.id).receipt,row.receipt)
 const updated=await h.command('intakeForm.publish',{...templateInput(),templateId:a.id,version:a.version,diagnosticFeeCents:9500,storageTerms:'New storage terms for new intakes only.'});assert.equal(updated.revisions.length,2)
 const download=await request(link.url+'?download=1');assert.equal(download.status,200);assert.deepEqual(await download.json(),row.receipt)
 const device=await h.command('intakeForm.create',{jobId:job.id,version:job.version,templateId:b.id,templateVersion:b.version});assert.equal(device.template.kind,'device');await h.command('intakeForm.revoke',{formId:device.id,version:device.version,reason:'Wrong device template'});assert.equal((await request(device.url)).status,404)
 const expired=await h.command('intakeForm.create',{jobId:job.id,version:job.version,templateId:updated.id,templateVersion:updated.version});assert.equal(expired.template.diagnosticFeeCents,9500)
 await h.configure({MAIL_PROVIDER:'development'})
 const offline=await h.command('intakeForm.create',{jobId:job.id,version:job.version,templateId:updated.id,templateVersion:updated.version});const offlineHtml=await formPost(h,offline.url,{...fields,version:offline.version});assert.ok(offlineHtml.includes('Copy send outcome: unavailable'));const offlineRow=(await h.state()).records.intakeForm.find(f=>f.id===offline.id);assert.equal(offlineRow.status,'signed');assert.equal(offlineRow.copy.status,'unavailable');assert.equal((await request(offline.url+'?download=1')).status,200)
 assert.equal((await h.state(bearer)).records.intakeForm?.length??0,0);assert.equal((await h.request('/app/intake-templates',bearer)).status,403)
 const backup=await archive(h);assert.ok(backup[0].excludedTables.includes('mallet_intake_form_links'));assert.ok(!JSON.stringify(backup).includes(new URL(link.url).pathname.split('/').at(-1)))
 const fresh=await installation({bindings:{OWNER_EMAIL:'form-recovery@example.test'}})
 try{await restore(fresh,backup);const state=await fresh.state();assert.deepEqual(state.records.intakeForm,(await h.state()).records.intakeForm);assert.deepEqual(state.records.intakeTemplate,(await h.state()).records.intakeTemplate);const restoredUrl=fresh.origin+new URL(link.url).pathname;assert.equal((await fresh.mf.dispatchFetch(restoredUrl)).status,404);await fresh.state({as:h.owner,status:401})}finally{await fresh.close()}
 await h.command('intakeForm.revoke',{formId:row.id,version:row.version,reason:'Customer requested link withdrawal'});assert.equal((await request(link.url)).status,404);assert.equal((await request(h.origin+'/intake/'+'A'.repeat(43))).status,404)
 return {a,b,job,row}
}
