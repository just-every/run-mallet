import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {archive,installation,restore} from '../harness.mjs'
import {shopSetup} from './diagnosis-journey.mjs'

export const checkInTemplate={name:'synthetic-mallet-1',kind:'vehicle',diagnosticFeeCents:7500,storageTerms:'No storage charge for this check-in.',teardownTerms:'Diagnosis only; teardown requires separate permission.',fields:[{key:'concern',label:'When does the concern occur?',required:true}],acknowledgments:[{key:'storageCharges',text:'I acknowledge the stated storage terms.'}]}
export const checkInFields={contactName:'synthetic-mallet-2',email:'synthetic-mallet-2@example.test',phone:'synthetic-mallet-3',vehicleIdentifier:'synthetic-mallet-4',requestedWork:'Investigate cold-start noise; requested brake replacement is not approved.',channel:'drop-box',keyDrop:'Keys in sealed envelope; no access code supplied.',typedName:'synthetic-mallet-2',diagnosticConsent:'yes',electronicConsent:'yes','answer:concern':'Only on the first cold start.','acknowledgment:storageCharges':'yes'}
export async function checkInPost(h,url,fields,{status=200,origin=h.origin}={}){
 const response=await h.mf.dispatchFetch(url,{method:'POST',headers:{origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(fields)})
 const html=await response.text();assert.equal(response.status,status,html.slice(0,500));return html
}
const verifyHash=receipt=>{const {sha256,...base}=receipt;assert.equal(sha256,createHash('sha256').update(JSON.stringify(base)).digest('hex'))}
const requestRow=async(h,id)=>(await h.state()).records.counterIntake.find(row=>row.id===id)

export async function checkInJourney(h){
 await shopSetup(h)
 await h.command('tax.configure',{ratePercent:7.5,partsTaxable:true,laborTaxable:true})
 const asset=await h.command('asset.create',{customerName:checkInFields.contactName,customerEmail:checkInFields.email,label:'synthetic-mallet-5',identifier:checkInFields.vehicleIdentifier})
 const template=await h.command('intakeForm.publish',checkInTemplate)
 const invitation=await h.command('checkin.issue',{templateId:template.id,templateVersion:template.version})
 const member=await h.person('synthetic-mallet-201@example.test'),admin=await h.person('synthetic-mallet-202@example.test','admin'),key=await h.command('agent.create',{label:'No customer check-in access'}),bearer={as:'',headers:{authorization:'Bearer '+key.token}}
 for(const options of [{as:'',status:401},{as:member.cookie,status:403},{...bearer,status:403}])await h.command('checkin.issue',{templateId:template.id,templateVersion:template.version},options)
 await h.command('checkin.submit',{requestId:invitation.id},{status:404})
 assert.equal((await h.request('/app/check-ins',{as:member.cookie})).status,403)
 const read=async(url=invitation.url)=>h.mf.dispatchFetch(url)
 const page=await read();assert.equal(page.status,200);assert.equal(page.headers.get('cache-control'),'no-store')
 const initial=await page.text();assert.ok(initial.includes(checkInTemplate.name));assert.ok(initial.includes(checkInTemplate.acknowledgments[0].text))
 for(const disclosure of Object.values(invitation.electronicDisclosures)){const position=initial.indexOf(disclosure.replaceAll('&','&amp;'));assert.ok(position>=0&&position<initial.indexOf('name="electronicConsent"'),'Disclosures precede electronic consent')}
 assert.equal(invitation.quote.totals.totalCents,8063,'Diagnostic quote includes configured labor sales tax rounded to cents')
 const fields={...checkInFields,diagnosticTotalCents:invitation.quote.totals.totalCents}
 await checkInPost(h,invitation.url,fields,{origin:'https://other.test',status:403})
 const missingAcknowledgment={...fields};delete missingAcknowledgment['acknowledgment:storageCharges']
 await checkInPost(h,invitation.url,missingAcknowledgment,{status:422})
 const missingAnswer={...fields};delete missingAnswer['answer:concern']
 await checkInPost(h,invitation.url,missingAnswer,{status:422})
 await checkInPost(h,invitation.url,{...fields,diagnosticTotalCents:7500},{status:409})
 assert.equal((await requestRow(h,invitation.id)).status,'invited')
 const sends=h.messages.length
 await checkInPost(h,invitation.url,fields)
 let row=await requestRow(h,invitation.id)
 assert.equal(row.status,'queued');assert.equal(row.jobId,null);assert.equal(row.confirmation,null)
 assert.equal(row.receipt.submission.channel,'drop-box');assert.equal(row.receipt.submission.answers.concern,fields['answer:concern']);assert.equal(row.receipt.submission.acknowledgments.storageCharges,true)
 assert.equal(row.receipt.signature.identityVerified,false);assert.equal(row.receipt.quote.totals.totalCents,8063);verifyHash(row.receipt)
 assert.equal((await h.state(bearer)).records.counterIntake?.length??0,0);assert.ok(!(await h.state(bearer)).records.event.some(e=>e.kind.startsWith('checkin.')))
 const receipt=structuredClone(row.receipt),before=await h.state()
 assert.equal(before.records.job?.length??0,0);assert.equal(before.records.estimate?.length??0,0)
 await checkInPost(h,invitation.url,fields)
 assert.deepEqual(await requestRow(h,invitation.id),row,'Identical customer replay makes no second intake or state change')
 await checkInPost(h,invitation.url,{...fields,requestedWork:'Replace all brakes now'},{status:409})
 assert.deepEqual((await requestRow(h,invitation.id)).receipt,receipt)
 const download=await read(invitation.url+'?download=1');assert.equal(download.status,200);assert.match(download.headers.get('content-type'),/^text\/html/)
 const printable=await download.text();for(const value of [receipt.sha256,fields.contactName,fields.vehicleIdentifier,fields.requestedWork,fields['answer:concern'],checkInTemplate.storageTerms])assert.ok(printable.includes(value),'Printable receipt contains '+value)
 const published=await h.command('intakeForm.publish',{...checkInTemplate,templateId:template.id,version:template.version,diagnosticFeeCents:9500,storageTerms:'Changed terms apply to later invitations only.'})
 assert.equal(published.revisions.length,2);assert.deepEqual((await requestRow(h,row.id)).receipt,receipt)
 const confirm={requestId:row.id,version:row.version,assetId:asset.id,assetVersion:asset.version,contactEvidence:'Advisor called the supplied contact and verified their existing customer record.',vehicleEvidence:'Advisor inspected the vehicle identifier and matched the existing vehicle.',keyReceipt:'Advisor received the sealed envelope and physical key.',bayId:'synthetic-mallet-6',technicianId:before.actor.id,startAt:'2026-10-23T09:00:00+10:00',endAt:'2026-10-23T10:00:00+10:00',reviewedDiagnosticTotalCents:8063,confirmBooking:true,confirmDiagnosticSpend:true}
 await h.command('checkin.confirm',{...confirm,confirmBooking:false},{status:409})
 await h.command('checkin.confirm',{...confirm,confirmDiagnosticSpend:false},{status:409})
 await h.command('checkin.confirm',{...confirm,reviewedDiagnosticTotalCents:7500},{status:409})
 await h.command('tax.configure',{ratePercent:8,partsTaxable:true,laborTaxable:true})
 await h.command('checkin.confirm',confirm,{status:409})
 assert.equal((await h.state()).records.job?.length??0,0,'Tax change cannot leave a partial booking')
 await h.command('tax.configure',{ratePercent:7.5,partsTaxable:true,laborTaxable:true})
 row=await h.command('checkin.confirm',confirm,{as:admin.cookie})
 assert.equal(row.status,'confirmed');assert.equal(row.confirmation.assetId,asset.id);assert.equal(row.confirmation.customerReceiptSha256,receipt.sha256);verifyHash(row.confirmation)
 let state=await h.state(),job=state.records.job.find(j=>j.id===row.confirmation.jobId),estimate=state.records.estimate.find(e=>e.id===row.confirmation.estimateId)
 assert.equal(state.records.job.length,1);assert.equal(state.records.estimate.length,1);assert.equal(job.assetId,asset.id)
 assert.deepEqual(estimate.revisions[0].lines,invitation.quote.lines);assert.equal(estimate.authorisation.method,'signed');assert.ok(estimate.authorisation.evidence.includes(row.id));assert.equal(estimate.authorisation.totals.totalCents,8063)
 assert.deepEqual(estimate.authorisation.lineIds,[invitation.quote.lines[0].id]);assert.ok(!JSON.stringify(estimate.revisions[0].lines).includes('brake replacement'))
 await checkInPost(h,invitation.url,fields);assert.deepEqual(await requestRow(h,row.id),row)
 await h.command('checkin.confirm',{...confirm,version:row.version},{status:409})
 await h.command('work.record',{jobId:job.id,version:job.version,lineId:'synthetic-mallet-7',quantity:1,note:'Requested repair scope remains unapproved.'},{status:409})
 job=await h.command('work.record',{jobId:job.id,version:job.version,lineId:invitation.quote.lines[0].id,quantity:1,note:'Performed only the consented diagnostic assessment.'})
 assert.equal(job.actuals.length,1);assert.equal(job.actuals[0].lineId,invitation.quote.lines[0].id)
 state=await h.state();assert.equal(state.records.counterIntake.length,1);assert.equal(state.records.job.length,1);assert.equal(state.records.estimate.length,1);assert.deepEqual(state.records.counterIntake[0].receipt,receipt);assert.equal(h.messages.length,sends,'Check-in submits and confirms without outbound messages or payment charges')
 await h.command('checkin.revoke',{requestId:row.id,version:row.version,reason:'Customer requested private invitation withdrawal.'})
 assert.equal((await read()).status,404)
 return {row:await requestRow(h,row.id),receipt,invitation,asset,template}
}

export async function checkInRecoveryJourney(h){
 const {row,invitation}=await checkInJourney(h),backup=await archive(h)
 assert.ok(backup[0].excludedTables.includes('mallet_checkin_links'))
 assert.ok(!JSON.stringify(backup).includes(new URL(invitation.url).pathname.split('/').at(-1)))
 const fresh=await installation({bindings:{OWNER_EMAIL:'synthetic-mallet-8@example.test'}})
 try{
  await restore(fresh,backup);const state=await fresh.state()
  assert.deepEqual(state.records.counterIntake,[row]);assert.equal(state.records.job.length,1)
  assert.equal((await fresh.mf.dispatchFetch(fresh.origin+new URL(invitation.url).pathname)).status,404)
 }finally{await fresh.close()}
}
