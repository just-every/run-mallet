import {qualityReady} from './quality-ready.mjs'
import assert from 'node:assert/strict'
import {installation,archive,restore,booking,assetInput} from '../harness.mjs'
import {creditAccountFixture,creditInvoice,creditInput,issueCredit} from './refunds-journey.mjs'
export async function taxCustodyJourney(){
 const h=await installation()
 try{
  const {account}=await taxAccountFixture(h),{invoice}=await creditInvoice(h,account),admin=await h.person('certificate-admin@example.test','admin')
  const input={accountId:account.id,version:account.version,reference:'synthetic-mallet-320',jurisdiction:'California - declared shop district',scope:'parts',validFrom:'2000-01-01',expiresOn:'2001-01-01',certificate:'Synthetic fleet resale certificate: exact supplied text.',evidence:'Owner reviewed the customer-provided synthetic certificate; no eligibility verification claimed'}
  for(const options of [{as:'',status:401},{as:admin.cookie,status:403},{headers:{origin:'https://other.example.test'},status:403}])await h.command('tax.certificate',input,options)
  for(const changed of [{expiresOn:'1999-01-01'},{validFrom:'2026-02-30'},{scope:'inferred'},{version:account.version+1}])await h.command('tax.certificate',{...input,...changed},{status:changed.scope||changed.expiresOn||changed.validFrom?400:409})
  const certificate=await h.command('tax.certificate',input);assert.equal(certificate.certificate,input.certificate);assert.equal(certificate.scope,'parts')
  assert.equal((await h.state({as:admin.cookie})).records.taxCertificate,undefined)
  const original=JSON.stringify((await h.state()).records.invoice),assignment={invoiceId:invoice.id,version:invoice.version,jurisdiction:input.jurisdiction,evidence:'Owner reviewed the invoice location and retained jurisdiction evidence'}
  await h.command('tax.assignJurisdiction',assignment,{as:admin.cookie,status:403})
  let report=await h.api('/api/mallet/tax/report');assert.match(report.groups[0].jurisdiction,/Unassigned/)
  const assigned=await h.command('tax.assignJurisdiction',assignment);assert.equal(assigned.invoiceRevision,invoice.revision)
  await h.command('tax.assignJurisdiction',assignment,{status:409})
  await h.command('payment.record',{invoiceId:invoice.id,version:invoice.version,method:'cash',amountCents:541,reference:'synthetic-mallet-322',evidence:'Owner counted original tender before returning the accessory'})
  const note=await issueCredit(h,creditInput(invoice,null,'synthetic-mallet-321'))
  report=await h.api('/api/mallet/tax/report');assert.equal(report.groups.length,1);assert.equal(report.groups[0].invoicedTaxCents,38);assert.equal(report.groups[0].reversedTaxCents,8);assert.equal(report.groups[0].netTaxCents,30);assert.deepEqual(report.groups[0].invoices[0].creditNoteIds,[note.id]);assert.match(report.basis,/not a cash-collected/)
  assert.equal(JSON.stringify((await h.state()).records.invoice),original,'Certificate custody and filing declarations never reprice authorized invoices')
  const setup=await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',redirect:'manual',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes&ratePercent=7.5&partsTaxable=yes'});assert.equal(setup.status,303)
  const page=await h.request('/app/tax/custody');assert.equal(page.status,200);assert.match(await page.text(),/expired/)
  assert.equal((await h.request('/api/mallet/tax/report',{as:admin.cookie})).status,403)
  await taxAdjustmentJourney(h,account,certificate,admin)
  report=await h.api('/api/mallet/tax/report')
  const records=(await h.state()).records,fresh=await installation({bindings:{OWNER_EMAIL:'tax-custody-recovery@example.test'}})
  try{await restore(fresh,await archive(h));for(const kind of ['taxCertificate','taxFeeRule','taxJurisdiction','estimate','invoice','invoiceDocument','creditNote'])assert.deepEqual((await fresh.state()).records[kind],records[kind]);assert.deepEqual(await fresh.api('/api/mallet/tax/report'),report);assert.equal(fresh.messages.length,0)}finally{await fresh.close()}
 }finally{await h.close()}
}

export async function taxDraftFixture(h,account,suffix='1'){
 let asset=await h.command('asset.create',{...assetInput('tax-adjust-'+suffix),customerName:account.name})
 asset=await h.command('customer.linkAsset',{assetId:asset.id,version:asset.version,customerId:account.id,customerVersion:account.version,reason:'Customer explicitly linked this fleet repair'})
 const start=Date.now()+((await h.state()).records.job.length+1)*86400000
 const {job}=await booking(h,{asset,bayId:'Tax review bay '+suffix,startAt:new Date(start).toISOString(),endAt:new Date(start+3600000).toISOString()})
 const q=await h.command('estimate.prepare',{jobId:job.id,version:job.version,lines:[{kind:'part',description:'Fleet replacement part',quantity:2,unitCents:10000,unitDiscountCents:1000},{kind:'labor',description:'Fleet service',quantity:1,unitCents:10000}]})
 return {job,q}
}
async function taxAdjustmentJourney(h,account,expired,admin){
 await h.command('tax.configure',{ratePercent:7.5,partsTaxable:true,laborTaxable:true})
 const {job,q}=await taxDraftFixture(h,account),original=structuredClone(q.revisions[0])
 const ruleInput={name:'Capped supplies',basis:'parts and labor',rateBps:1000,capCents:2500,taxable:true,legalBasis:'Owner reviewed the applicable shop supplies rule; customer explicitly requested this quote'}
 await h.command('tax.suppliesRule',ruleInput,{as:admin.cookie,status:403})
 for(const change of [{rateBps:10001},{capCents:-1},{taxable:'yes'},{category:'inferred'},{mode:'fixed',fixedCents:-1}])await h.command('tax.suppliesRule',{...ruleInput,...change},{status:400})
 const rule=await h.command('tax.suppliesRule',ruleInput)
 const active=await h.command('tax.certificate',{accountId:account.id,version:account.version,reference:'synthetic-mallet-341',jurisdiction:'Declared fleet district',scope:'parts',validFrom:'2000-01-01',expiresOn:'2099-12-31',certificate:'Private synthetic certificate original',evidence:'Owner reviewed the supplied certificate'})
 const input={estimateId:q.id,version:q.version,certificateId:active.id,feeRuleId:rule.id,feeVersion:rule.version,consent:true,evidence:'Customer explicitly consented to the exact capped fee and owner-applied certificate basis'}
 for(const options of [{as:admin.cookie,status:403},{as:'',status:401},{headers:{origin:'https://other.example.test'},status:403}])await h.command('tax.adjustEstimate',input,options)
 const refuse=async(change,error,status=409)=>{const before=await h.state(),messages=h.messages.length;const result=await h.command('tax.adjustEstimate',{...input,...change},{status});assert.equal(result.error,error);assert.deepEqual((await h.state()).records,before.records,'Rejected tax review leaves every product record and audit event unchanged');assert.equal(h.messages.length,messages,'Rejected tax review creates no mail')}
 for(const consent of [false,undefined,'true'])await refuse({consent},'TAX_CONSENT')
 await refuse({evidence:''},'INPUT',400)
 await refuse({certificateId:expired.id},'TAX_EXPIRED')
 await refuse({feeVersion:2},'VERSION')
 const feesOnly=await h.command('tax.certificate',{accountId:account.id,version:account.version,reference:'synthetic-mallet-344',jurisdiction:'Declared fleet district',scope:'fees',validFrom:'2000-01-01',expiresOn:'2099-12-31',certificate:'Fee-only synthetic certificate',evidence:'Owner recorded the exact limited scope'})
 await refuse({certificateId:feesOnly.id,feeRuleId:''},'TAX_SCOPE')
 const other=await creditAccountFixture(h,'tax-other'),mismatch=await taxDraftFixture(h,other.account,'2')
 await h.command('tax.adjustEstimate',{...input,estimateId:mismatch.q.id,version:mismatch.q.version},{status:409})
 const future=await h.command('tax.certificate',{accountId:account.id,version:account.version,reference:'synthetic-mallet-343',jurisdiction:'Declared fleet district',scope:'parts',validFrom:'2098-01-01',expiresOn:'2099-12-31',certificate:'Future synthetic certificate',evidence:'Future-dated certificate is custody only'})
 await refuse({certificateId:future.id},'TAX_EXPIRED')
 let changed=(await h.state()).records.asset.find(a=>a.id===job.assetId)
 changed=await h.command('customer.linkAsset',{assetId:changed.id,version:changed.version,customerId:other.account.id,customerVersion:other.account.version,reason:'Owner recorded a different current billing relationship'})
 await refuse({},'TAX_ACCOUNT')
 await h.command('customer.linkAsset',{assetId:changed.id,version:changed.version,customerId:account.id,customerVersion:account.version,reason:'Owner restored the original billing relationship for a fresh review'})
 for(const [index,category]of ['disposal','environmental'].entries()){
  const feeRule=await h.command('tax.suppliesRule',{...ruleInput,name:category+' fee',category,basis:'parts',rateBps:500,capCents:700,...(category==='environmental'?{mode:'fixed',fixedCents:900}:{})})
  const draft=await taxDraftFixture(h,account,'category-'+index)
  const reviewed=await h.command('tax.adjustEstimate',{estimateId:draft.q.id,version:draft.q.version,feeRuleId:feeRule.id,feeVersion:feeRule.version,consent:true,evidence:'Customer accepted the disclosed '+category+' fee, percentage basis and cap'})
  const revision=reviewed.revisions.at(-1);assert.equal(revision.taxAdjustment.fee.category,category);assert.equal(revision.taxAdjustment.fee.amountCents,700);assert.equal(revision.lines.at(-1).salesTaxCents,53);assert.deepEqual(reviewed.revisions[0],draft.q.revisions[0])
  const billed=await finishTaxInvoice(h,reviewed),issued=await h.command('invoice.issue',{invoiceId:billed.id,version:billed.version,reference:'synthetic-mallet-category-'+index,warrantyTerms:'Reviewed warranty terms',confirm:'issue-invoice'})
  assert.ok(issued.content.includes(category+' fee basis parts $180.00; '+(category==='environmental'?'fixed $9.00':'5%')+'; cap $7.00; fee $7.00'))
 }
 const uncapped=await h.command('tax.suppliesRule',{...ruleInput,basis:'parts',rateBps:1,capCents:100000})
 const rounding=await h.command('estimate.revise',{estimateId:mismatch.q.id,version:mismatch.q.version,revision:1,lines:[{kind:'part',description:'Half-cent fee basis',quantity:1,unitCents:15000}]})
 const small=await h.command('tax.adjustEstimate',{...input,estimateId:mismatch.q.id,version:rounding.version,certificateId:'',feeRuleId:uncapped.id,feeVersion:uncapped.version})
 assert.equal(small.revisions.at(-1).lines.at(-1).unitCents,2,'An uncapped 1.5 cent fee rounds half up to two cents')
 const adjusted=await h.command('tax.adjustEstimate',input),rev=adjusted.revisions.at(-1)
 assert.deepEqual(adjusted.revisions[0],original);assert.equal(rev.n,2)
 assert.deepEqual(rev.lines.map(l=>l.salesTaxCents),[0,750,188]);assert.equal(rev.lines[2].unitCents,2500);assert.equal(rev.taxAdjustment.fee.baseCents,28000)
 assert.equal(rev.totals.totalCents,31438);assert.ok(!JSON.stringify(rev).includes(active.certificate))
 await h.command('tax.adjustEstimate',{...input,version:adjusted.version},{status:409})
 const invoice=await finishTaxInvoice(h,adjusted)
 await h.command('tax.adjustEstimate',{...input,version:(await h.state()).records.estimate.find(q=>q.id===adjusted.id).version},{status:409})
 assert.deepEqual(invoice.totals,rev.totals)
 const doc=await h.command('invoice.issue',{invoiceId:invoice.id,version:invoice.version,reference:'synthetic-mallet-342',warrantyTerms:'Shop reviewed warranty terms',confirm:'issue-invoice'})
 assert.match(doc.content,/Owner-applied certificate synthetic-mallet-341/);assert.match(doc.content,/Supplies basis parts and labor \$280.00; 10%; cap \$25.00; fee \$25.00/)
 assert.ok(!doc.content.includes(active.certificate));assert.equal((await h.state({as:admin.cookie})).records.taxFeeRule,undefined)
 await h.command('tax.configure',{ratePercent:20});assert.equal((await h.state()).records.invoice.find(i=>i.id===invoice.id).totals.totalCents,31438)
}

export async function finishTaxInvoice(h,adjusted){
 const rev=adjusted.revisions.at(-1)
 const job=(await h.state()).records.job.find(j=>j.id===adjusted.jobId)
 const before=(await h.state()).records
 await h.command('work.record',{jobId:job.id,version:job.version,lineId:rev.lines[0].id,quantity:1},{status:409})
 assert.deepEqual((await h.state()).records,before)
 await h.command('estimate.authorise',{estimateId:adjusted.id,version:adjusted.version,revision:rev.n,lineIds:rev.lines.map(l=>l.id),customerName:'Fleet authorizer',method:'signed',evidence:'Cannot skip renewed approval'},{status:409})
 let next=await h.command('estimate.approve',{estimateId:adjusted.id,version:adjusted.version,revision:rev.n})
 next=await h.command('estimate.markSent',{estimateId:adjusted.id,version:next.version,revision:rev.n,method:'printed'})
 next=await h.command('estimate.authorise',{estimateId:adjusted.id,version:next.version,revision:rev.n,lineIds:rev.lines.map(l=>l.id),customerName:'Recorded fleet authorizer',method:'signed',evidence:'Signed authorization to exact disclosed fee and exemption basis'})
 let current=(await h.state()).records.job.find(j=>j.id===adjusted.jobId)
 for(const line of rev.lines)current=await h.command('work.record',{jobId:current.id,version:current.version,lineId:line.id,quantity:line.quantity})
 await qualityReady(h,current);current=await h.command('job.complete',{jobId:current.id,version:current.version})
 let invoice=await h.command('invoice.prepare',{jobId:current.id,version:current.version});return h.command('invoice.approve',{invoiceId:invoice.id,version:invoice.version})
}

export async function taxAccountFixture(h){
 const {account,contact}=await creditAccountFixture(h)
 return {account:await h.command('customer.save',{...account,customerId:account.id,kind:'fleet',name:'Synthetic fleet',authorizerId:contact.id}),contact}
}
