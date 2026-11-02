import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {installation,archive,restore,booking,estimate,authorise} from '../harness.mjs'
import {qualityReady} from './quality-ready.mjs'
import {creditAccountFixture,creditInvoice} from './refunds-journey.mjs'
export async function mixedDocumentInvoice(h){
 const {job}=await booking(h)
 await h.command('tax.configure',{ratePercent:7.5,partsTaxable:true,laborTaxable:false})
 let q=await h.command('estimate.prepare',{jobId:job.id,version:job.version,lines:[{kind:'part',description:'Brake pads',quantity:2,unitCents:2500,unitDiscountCents:100,costCents:800},{kind:'labor',description:'Fit and test brakes',quantity:1.5,unitCents:10000},{kind:'fee',description:'Disposal fee, agreed on signed estimate',quantity:1,unitCents:500,feeTaxable:true}]})
 q=await authorise(h,q)
 let j=(await h.state()).records.job.find(x=>x.id===job.id)
 for(const line of q.revisions[0].lines)j=await h.command('work.record',{jobId:j.id,version:j.version,lineId:line.id,quantity:line.quantity})
 await qualityReady(h,j)
 j=await h.command('reading.record',{jobId:j.id,version:j.version,value:45000,unit:'miles',stage:'out',observedAt:new Date(Date.now()-1000).toISOString()}).then(()=>h.state()).then(s=>s.records.job.find(x=>x.id===job.id))
 j=await h.command('job.complete',{jobId:j.id,version:j.version})
 let invoice=await h.command('invoice.prepare',{jobId:j.id,version:j.version});invoice=await h.command('invoice.approve',{invoiceId:invoice.id,version:invoice.version})
 const exported=await h.command('invoice.export',{invoiceId:invoice.id,version:invoice.version});invoice=(await h.state()).records.invoice.find(x=>x.id===invoice.id)
 await h.command('payment.record',{invoiceId:invoice.id,version:invoice.version,method:'cash',amountCents:1000,reference:'synthetic-mallet-301',evidence:'Cash counted by owner'})
 return {invoice,exported,job:j}
}
export const issueInput=(invoice,reference='synthetic-mallet-302')=>({invoiceId:invoice.id,version:invoice.version,reference,warrantyTerms:'Shop-declared 12 months on installed parts; contact the shop for coverage review.',confirm:'issue-invoice'})
export async function invoiceDocumentsJourney(){
 let mode='accepted';const h=await installation({mailService:()=>mode==='accepted'?Response.json({id:'synthetic-mallet-303'}):new Response('Refused',{status:422})})
 try{
  const setup=await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',redirect:'manual',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes&ratePercent=7.5&partsTaxable=yes'});assert.equal(setup.status,303)
  const {invoice,exported,job}=await mixedDocumentInvoice(h),input=issueInput(invoice),original=JSON.stringify(invoice),savedCsv=await (await h.request('/api/mallet/exports/'+exported.id)).text()
  const admin=await h.person('invoice-admin@example.test','admin'),member=await h.person('invoice-tech@example.test'),key=await h.command('agent.create',{label:'Invoice document authority refused'})
  const options=[{as:'',status:401},{as:admin.cookie,status:403},{as:member.cookie,status:403},{as:'',headers:{authorization:'Bearer '+key.token},status:403},{headers:{origin:'https://other.example.test'},status:403}]
  for(const command of ['invoice.issue','invoice.send'])for(const option of options)await h.command(command,input,option)
  for(const command of ['invoice.deliveryClaim','invoice.deliveryOutcome'])await h.command(command,input,{status:404})
  await h.command('invoice.issue',{...input,version:invoice.version-1},{status:409})
  await h.command('invoice.issue',{...input,confirm:''},{status:409})
  const doc=await h.command('invoice.issue',input)
  assert.deepEqual(await h.command('invoice.issue',input),doc)
  assert.equal(doc.snapshot.totals.totalCents,20698);assert.equal(doc.snapshot.balance.paidCents,1000);assert.equal(doc.snapshot.balance.outstandingCents,19698)
  assert.match(doc.content,/45000 miles/);assert.match(doc.content,/Disposal fee/);assert.match(doc.content,/unit discount \$1.00/);assert.match(doc.content,/Sales tax \$3\.98/);assert.ok(!JSON.stringify(doc).includes('costCents'))
  const pdf=await h.request('/api/mallet/invoice-documents/'+doc.id+'.pdf'),bytes=Buffer.from(await pdf.arrayBuffer());assert.equal(pdf.status,200);assert.equal(pdf.headers.get('content-type'),'application/pdf');assert.equal(bytes.subarray(0,8).toString(),'%PDF-1.4');assert.match(bytes.toString(),/xref/);assert.equal(createHash('sha256').update(bytes).digest('hex'),doc.pdfHash)
  assert.equal(await (await h.request('/api/mallet/invoice-documents/'+doc.id+'.txt')).text(),doc.content)
  assert.match(await (await h.request('/app/invoice-documents/'+doc.id+'/print')).text(),/206.98/)
  for(const option of [options[0],options[1],options[2],options[3]])assert.equal((await h.request('/api/mallet/invoice-documents/'+doc.id+'.pdf',option)).status,option.status)
  assert.equal((await h.state({as:admin.cookie})).records.invoiceDocument,undefined)
  const send={documentId:doc.id,version:doc.version,to:invoice.customer.customerEmail,consent:true,consentEvidence:'Customer explicitly asked the owner for this invoice email',confirm:'email-invoice'}
  const mailCount=h.messages.length
  await h.command('invoice.send',{...send,consent:false},{status:409});await h.command('invoice.send',{...send,to:'other@example.test'},{status:409});assert.equal(h.messages.length,mailCount)
  const race=await Promise.all([1,2].map(()=>h.request('/api/mallet/commands',{method:'POST',body:{command:'invoice.send',input:send}})))
  assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);assert.equal(h.messages.length,mailCount+1)
  const delivery=await race.find(r=>r.status===200).json();assert.equal(delivery.status,'accepted');const message=h.messages.at(-1);assert.equal(message.text,doc.content);assert.equal(message.attachments[0].content,doc.pdfBase64)
  await h.command('invoice.send',send,{status:409});assert.equal(h.messages.length,mailCount+1)
  await h.command('invoice.issue',{...input,reference:'synthetic-mallet-304'},{status:409})
  const corrected=await h.command('invoice.issue',{...input,reference:'synthetic-mallet-304',corrects:doc.id,reason:'Warranty wording clarified',warrantyTerms:'12 months on supplied parts; shop review required.'})
  assert.equal(corrected.corrects,doc.id);assert.equal(corrected.correctsNumber,doc.number);assert.notEqual(corrected.number,doc.number);assert.deepEqual(corrected.snapshot.totals,doc.snapshot.totals)
  mode='failed';const failed=await h.command('invoice.send',{...send,documentId:corrected.id,version:corrected.version});assert.equal(failed.status,'failed')
  await h.command('invoice.send',{...send,documentId:corrected.id,version:corrected.version},{status:409})
  await h.command('invoice.issue',{...input,reference:'synthetic-mallet-305',corrects:doc.id,reason:'Try skipping a correction'},{status:409})
  const latest=await h.command('invoice.issue',{...input,reference:'synthetic-mallet-305',corrects:corrected.id,reason:'Retain another explicit customer clarification'})
  assert.equal(latest.sequence,3);assert.equal(latest.corrects,corrected.id)
  await h.command('tax.configure',{ratePercent:30,partsTaxable:true,laborTaxable:true})
  assert.equal(await (await h.request('/api/mallet/invoice-documents/'+doc.id+'.txt')).text(),doc.content)
  assert.equal(JSON.stringify((await h.state()).records.invoice.find(i=>i.id===invoice.id)),original);assert.equal(await (await h.request('/api/mallet/exports/'+exported.id)).text(),savedCsv)
  const final=(await h.state()).records,fresh=await installation({bindings:{OWNER_EMAIL:'invoice-recovery@example.test'}})
  try{await restore(fresh,await archive(h));const restored=(await fresh.state()).records;for(const kind of ['invoice','export','invoiceDocument','invoiceDelivery'])assert.deepEqual(restored[kind],final[kind]);assert.equal(await (await fresh.request('/api/mallet/invoice-documents/'+doc.id+'.txt')).text(),doc.content);assert.equal(fresh.messages.length,0);assert.equal((await fresh.command('invoice.send',{...send,documentId:latest.id,version:latest.version},{status:409})).error,'INVOICE_AUTHORITY');await fresh.state({as:h.owner,status:401})}finally{await fresh.close()}
 }finally{await h.close()}
}
