import assert from 'node:assert/strict'
import {archive,restore,installation} from '../harness.mjs'
import {qualityReady} from './quality-ready.mjs'
export const assetFixtures=[
 {assetType:'bicycle',label:'Trek brake repair',identifier:'synthetic-mallet-201',specifications:{frame:'Aluminum medium 54 cm',components:'Hydraulic disc brakes; 700c wheels'},part:'Bicycle brake pads',partCents:2500,labor:'Bleed and tune bicycle brakes',laborCents:8000,items:[{kind:'accessory',label:'Front light',quantity:1}]},
 {assetType:'device',label:'Serialized phone repair',identifier:'synthetic-mallet-202',specifications:{model:'Example phone 12',imei:'490154203237518',accessories:'Blue case and USB cable'},part:'Phone screen assembly',partCents:9000,labor:'Replace device screen',laborCents:7000,items:[{kind:'accessory',label:'Blue case',quantity:1},{kind:'accessory',label:'USB cable',quantity:1}]},
 {assetType:'vehicle',label:'Auto brake repair',identifier:'synthetic-mallet-203',specifications:{},part:'Auto brake pads',partCents:5000,labor:'Replace auto brakes',laborCents:12000,items:[{kind:'key',label:'Vehicle key',quantity:1}]},
 {assetType:'equipment',label:'Generator service',identifier:'synthetic-mallet-204',specifications:{model:'Example generator 2000'},part:'Generator filter',partCents:1500,labor:'Service generator',laborCents:6000,items:[{kind:'accessory',label:'Power cable',quantity:1}]}
]
export const assetInput=f=>({customerName:'Bench customer '+f.assetType,customerEmail:f.assetType+'@example.test',assetType:f.assetType,label:f.label,identifier:f.identifier,specifications:f.specifications})
export const custodyInput=(job,f)=>({jobId:job.id,version:job.version,phase:'before',capturedAt:new Date(Date.now()-1000).toISOString(),damage:'Observed scratches recorded before work on '+f.assetType,items:f.items,attachmentIds:[],lockHandling:'Customer keeps credentials; no unlock secret collected',signedBy:job.asset.customerName,consent:true})
export const currentJob=async(h,id)=>(await h.state()).records.job.find(j=>j.id===id)
export async function repairToInvoice(h,job,f,{reviewer}={}){
 await h.command('tax.configure',{ratePercent:7.5,partsTaxable:true,laborTaxable:false})
 let quote=await h.command('estimate.prepare',{jobId:job.id,version:job.version,lines:[{kind:'part',description:f.part,quantity:2,unitCents:f.partCents},{kind:'labor',description:f.labor,quantity:1,unitCents:f.laborCents}]})
 quote=await h.command('estimate.approve',{estimateId:quote.id,version:quote.version,revision:1})
 quote=await h.command('estimate.markSent',{estimateId:quote.id,version:quote.version,revision:1,method:'printed'})
 quote=await h.command('estimate.authorise',{estimateId:quote.id,version:quote.version,revision:1,lineIds:quote.revisions[0].lines.map(l=>l.id),customerName:job.asset.customerName,method:'signed',evidence:'Customer signed this exact typed-asset estimate at the counter'})
 await h.command('tax.configure',{ratePercent:0,partsTaxable:false,laborTaxable:true})
 job=await currentJob(h,job.id)
 for(const line of quote.revisions[0].lines)job=await h.command('work.record',{jobId:job.id,version:job.version,lineId:line.id,quantity:line.quantity})
 await qualityReady(h,job,{reviewer});job=await h.command('job.complete',{jobId:job.id,version:job.version})
 let invoice=await h.command('invoice.prepare',{jobId:job.id,version:job.version});invoice=await h.command('invoice.approve',{invoiceId:invoice.id,version:invoice.version})
 const expectedTax=Math.round(f.partCents*2*0.075)
 assert.equal(invoice.totals.subtotalCents,f.partCents*2+f.laborCents);assert.equal(invoice.totals.salesTaxCents,expectedTax);assert.equal(invoice.totals.totalCents,f.partCents*2+f.laborCents+expectedTax)
 assert.equal(invoice.lines[0].description,f.part);assert.equal(invoice.lines[0].salesTaxCents,expectedTax);assert.equal(invoice.lines[1].salesTaxCents,0);assert.deepEqual(invoice.customer,job.asset)
 return {invoice,quote,job:await currentJob(h,job.id)}
}
export async function assetJourney(h){
 const completed=[]
 for(const [index,f]of assetFixtures.entries()){
  const input=assetInput(f),asset=await h.command('asset.create',input)
  await h.command('asset.create',{...input,identifier:input.identifier.toUpperCase()},{status:409})
  await h.command('asset.update',{...input,assetId:asset.id,version:asset.version,specifications:{vin:'Vehicle-only input'}},{status:400})
  let job=await h.command('job.book',{assetId:asset.id,version:asset.version,title:f.labor,technicianId:(await h.state()).actor.id,bayId:'Bench '+index,startAt:'2026-10-23T09:00:00Z',endAt:'2026-10-23T10:00:00Z'})
  await h.command('job.book',{assetId:asset.id,version:asset.version+1,title:'Competing repair',technicianId:'Another technician',bayId:job.bayId,startAt:job.startAt,endAt:job.endAt},{status:409})
  const intake=await h.command('intake.record',custodyInput(job,f));job=await currentJob(h,job.id)
  assert.equal(intake.asset.assetType,f.assetType);assert.deepEqual(intake.asset.specifications,f.specifications)
  const registered=(await h.state()).records.asset.find(a=>a.id===asset.id)
  await h.command('asset.update',{...input,assetId:asset.id,version:registered.version,assetType:f.assetType==='device'?'bicycle':'device',specifications:{}},{status:409})
  const changed={...input.specifications};if(f.assetType==='bicycle')changed.components='Later replacement component spec'
  await h.command('asset.update',{...input,assetId:asset.id,version:registered.version,specifications:changed})
  assert.deepEqual((await currentJob(h,job.id)).asset.specifications,f.specifications,'Visit retains its original asset details')
  const result=await repairToInvoice(h,job,f),invoice=result.invoice;job=result.job
  const comparison=await h.command('intake.compare',{jobId:job.id,version:job.version,intakeId:intake.id,returned:intake.items.map(i=>({itemId:i.id,quantity:i.quantity})),signedBy:job.asset.customerName,consent:true});job=await currentJob(h,job.id)
  let readingId=''
  if(['vehicle','equipment'].includes(f.assetType)){
   const reading=await h.command('reading.record',{jobId:job.id,version:job.version,stage:'out',unit:f.assetType==='equipment'?'hours':'miles',value:f.assetType==='equipment'?241:65000,observedAt:new Date(Date.now()-1000).toISOString()});readingId=reading.id;job=await currentJob(h,job.id)
  }
  const collect={jobId:job.id,version:job.version,flowVersion:0,collectorName:job.asset.customerName,comparisonId:comparison.id,readingId,identityEvidence:'Staff checked the customer in person without retaining identity documents',warrantyAdvice:'Repair warranty explained; ask the shop for a paper receipt.'}
  await h.command('flow.collect',collect,{status:409})
  await h.command('payment.record',{jobId:job.id,invoiceId:invoice.id,version:invoice.version,invoiceRevision:invoice.revision,method:'cash',amountCents:invoice.totals.totalCents,reference:'synthetic-mallet-'+(210+index),evidence:'Staff counted exact cash tender at the counter'})
  if(readingId)await h.command('flow.collect',{...collect,readingId:''},{status:409})
  const flow=await h.command('flow.collect',collect),receipt=(await h.state()).records.handover.find(r=>r.id===flow.collection.handoverId)
  assert.equal(receipt.invoice.customer.assetType,f.assetType);assert.deepEqual(receipt.invoice.customer.specifications,f.specifications);assert.deepEqual(receipt.comparison.returned.map(i=>i.label),f.items.map(i=>i.label));assert.ok(receipt.comparison.returned.every(i=>i.missingQuantity===0));assert.equal(receipt.settlement.tender.recordedCents,invoice.totals.totalCents);assert.equal(receipt.settlement.override,null);assert.equal(receipt.mileage?.unit??null,readingId?f.assetType==='equipment'?'hours':'miles':null)
  const exported=await h.command('invoice.export',{invoiceId:invoice.id,version:invoice.version});assert.ok(exported.csv.includes(f.part));assert.ok(exported.csv.includes(asset.identifier))
  const history=await (await h.request('/api/mallet/assets/'+asset.id+'/history.csv')).text();assert.ok(history.includes('payment.record'));assert.ok(history.includes('flow.collect'));assert.ok(!history.includes(assetFixtures.find(other=>other!==f).identifier))
  completed.push({asset,job,invoice,receipt,exported})
 }
 const backup=await archive(h),original=(await h.state()).records,fresh=await installation({bindings:{OWNER_EMAIL:'asset-recovery@example.test'}})
 try{await restore(fresh,backup);const recovered=(await fresh.state()).records;for(const kind of ['asset','job','estimate','invoice','intake','intakeComparison','handover','payment','reading','export'])assert.deepEqual(recovered[kind],original[kind],kind+' recovers exactly');await fresh.state({as:h.owner,status:401});for(const r of completed)assert.equal(await (await fresh.request('/api/mallet/exports/'+r.exported.id)).text(),r.exported.csv)}finally{await fresh.close()}
}
