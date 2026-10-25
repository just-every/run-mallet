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
  const payment=await h.command('payment.record',{invoiceId:invoice.id,version:invoice.version,method:'cash',amountCents:541,reference:'synthetic-mallet-322',evidence:'Owner counted original tender before returning the accessory'})
  const note=await issueCredit(h,creditInput(invoice,payment,'synthetic-mallet-321'))
  report=await h.api('/api/mallet/tax/report');assert.equal(report.groups.length,1);assert.equal(report.groups[0].invoicedTaxCents,38);assert.equal(report.groups[0].reversedTaxCents,8);assert.equal(report.groups[0].netTaxCents,30);assert.deepEqual(report.groups[0].invoices[0].creditNoteIds,[note.id]);assert.match(report.basis,/not a cash-collected/)
  let collected=report.groups[0];assert.equal(collected.collectedTaxCents,38);assert.equal(collected.reversedCollectedTaxCents,0,'Issuing a pending refund does not return collected tax');assert.equal(collected.netCollectedTaxCents,38)
  let refund=(await h.state()).records.refund.find(r=>r.creditNoteId===note.id)
  refund=await h.command('refund.record',{refundId:refund.id,version:refund.version,status:'failed',reference:'synthetic-mallet-tax-failed',evidence:'Owner observed failed cash refund',confirm:'record-refund'})
  assert.equal((await h.api('/api/mallet/tax/report')).groups[0].netCollectedTaxCents,38)
  const outcome={refundId:refund.id,version:refund.version,status:'refunded',reference:'synthetic-mallet-tax-refunded',evidence:'Owner returned the exact original cash',confirm:'record-refund'}
  await h.command('refund.record',outcome);await h.command('refund.record',outcome)
  collected=(await h.api('/api/mallet/tax/report')).groups[0];assert.equal(collected.reversedCollectedTaxCents,8);assert.equal(collected.netCollectedTaxCents,30);assert.deepEqual(collected.invoices[0].paymentIds,[payment.id]);assert.deepEqual(collected.invoices[0].refundIds,[refund.id])
  await collectionReportJourney(h,account)

  assert.equal(JSON.stringify((await h.state()).records.invoice.filter(i=>i.id===invoice.id)),original,'Certificate custody and filing declarations never reprice authorized invoices')
  const setup=await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',redirect:'manual',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes&ratePercent=7.5&partsTaxable=yes'});assert.equal(setup.status,303)
  const page=await h.request('/app/tax/custody');assert.equal(page.status,200);assert.match(await page.text(),/expired/)
  assert.equal((await h.request('/api/mallet/tax/report',{as:admin.cookie})).status,403)
  await taxAdjustmentJourney(h,account,certificate,admin)
  report=await h.api('/api/mallet/tax/report')
  const records=(await h.state()).records,fresh=await installation({bindings:{OWNER_EMAIL:'tax-custody-recovery@example.test'}})
  try{await restore(fresh,await archive(h));for(const kind of ['taxCertificate','taxDiscountRule','taxFeeRule','taxJurisdiction','estimate','invoice','invoiceDocument','creditNote','payment','refund'])assert.deepEqual((await fresh.state()).records[kind],records[kind]);assert.deepEqual(await fresh.api('/api/mallet/tax/report'),report);assert.equal(fresh.messages.length,0)}finally{await fresh.close()}
 }finally{await h.close()}
}

async function collectionReportJourney(h,account){
 const {invoice}=await creditInvoice(h,account,'2')
 await h.command('tax.assignJurisdiction',{invoiceId:invoice.id,version:invoice.version,jurisdiction:'Second declared district',evidence:'Owner reviewed the second repair location'})
 const current=async()=>(await h.api('/api/mallet/tax/report')).groups.find(g=>g.jurisdiction==='Second declared district')
 assert.equal((await current()).netCollectedTaxCents,0,'Unpaid invoice tax is not collected')
 const input={invoiceId:invoice.id,version:invoice.version,method:'cash',amountCents:270,reference:'synthetic-mallet-tax-partial',evidence:'Owner recorded a partial cash receipt'}
 await h.command('payment.record',input);await h.command('payment.record',input)
 assert.equal((await current()).netCollectedTaxCents,19,'Cumulative partial cash allocates original tax half up once; receipt replay cannot double count')
 const check=await h.command('payment.record',{...input,method:'check',amountCents:100,reference:'synthetic-mallet-tax-check'})
 let group=await current();assert.equal(group.netCollectedTaxCents,19);assert.deepEqual(group.invoices[0].excludedPaymentIds,[check.id]);assert.match(group.invoices[0].reviewReasons.join(' '),/Excluded check tender/)
 await h.command('payment.record',{...input,amountCents:171,reference:'synthetic-mallet-tax-final'})
 group=await current();assert.equal(group.collectedTaxCents,31);assert.equal(group.netTaxCents,38,'Invoice basis remains separate from collected tax')
 const before=(await h.state()).records,messages=h.messages.length
 await current();assert.deepEqual((await h.state()).records,before);assert.equal(h.messages.length,messages,'Reading the report causes no outbound action')
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
 const adjust=async(input,options={})=>{const messages=h.messages.length,result=await h.command('tax.adjustEstimate',input,options);assert.equal(h.messages.length,messages,'A tax adjustment creates no outbound action');return result}
 await h.command('tax.configure',{ratePercent:7.5,partsTaxable:true,laborTaxable:true})
 const {job,q}=await taxDraftFixture(h,account),original=structuredClone(q.revisions[0])
 const ruleInput={name:'Capped supplies',basis:'parts and labor',rateBps:1000,capCents:2500,taxable:true,legalBasis:'Owner reviewed the applicable shop supplies rule; customer explicitly requested this quote'}
 await h.command('tax.suppliesRule',ruleInput,{as:admin.cookie,status:403})
 for(const change of [{rateBps:10001},{capCents:-1},{taxable:'yes'},{category:'inferred'},{mode:'fixed',fixedCents:-1},{mode:'fixed',fixedCents:2501},{legalBasis:''}])await h.command('tax.suppliesRule',{...ruleInput,...change},{status:400})
 const beforeInvalid=(await h.state()).records,messagesBeforeInvalid=h.messages.length
 for(const command of ['tax.suppliesRule','tax.discountRule'])await h.command(command,{...ruleInput,legalBasis:''},{status:400})
 await h.command('tax.suppliesRule',{...ruleInput,mode:'fixed',fixedCents:2501},{status:400})
 assert.deepEqual((await h.state()).records,beforeInvalid);assert.equal(h.messages.length,messagesBeforeInvalid)
 const rule=await h.command('tax.suppliesRule',ruleInput)
 const active=await h.command('tax.certificate',{accountId:account.id,version:account.version,reference:'synthetic-mallet-341',jurisdiction:'Declared fleet district',scope:'parts',validFrom:'2000-01-01',expiresOn:'2099-12-31',certificate:'Private synthetic certificate original',evidence:'Owner reviewed the supplied certificate'})
 const input={estimateId:q.id,version:q.version,certificateId:active.id,feeRuleId:rule.id,feeVersion:rule.version,consent:true,evidence:'Customer explicitly consented to the exact capped fee and owner-applied certificate basis'}
 for(const options of [{as:admin.cookie,status:403},{as:'',status:401},{headers:{origin:'https://other.example.test'},status:403}])await adjust(input,options)
 const refuse=async(change,error,status=409)=>{const before=await h.state(),messages=h.messages.length;const result=await adjust({...input,...change},{status});assert.equal(result.error,error);assert.deepEqual((await h.state()).records,before.records,'Rejected tax review leaves every product record and audit event unchanged');assert.equal(h.messages.length,messages,'Rejected tax review creates no mail')}
 for(const consent of [false,undefined,'true'])await refuse({consent},'TAX_CONSENT')
 await refuse({evidence:''},'INPUT',400)
 await refuse({certificateId:expired.id},'TAX_EXPIRED')
 await refuse({feeVersion:2},'VERSION')
 const legacyRule=await h.command('tax.suppliesRule',{...ruleInput,name:'Previously saved fixed fee',mode:'fixed',fixedCents:2500})
 const db=await h.mf.getD1Database('DB')
 await db.prepare("UPDATE mallet_records SET value=json_set(value,'$.fixedCents',2501) WHERE kind='taxFeeRule' AND id=?").bind(legacyRule.id).run()
 await refuse({certificateId:'',feeRuleId:legacyRule.id,feeVersion:legacyRule.version},'TAX_FEE_CAP')
 const feesOnly=await h.command('tax.certificate',{accountId:account.id,version:account.version,reference:'synthetic-mallet-344',jurisdiction:'Declared fleet district',scope:'fees',validFrom:'2000-01-01',expiresOn:'2099-12-31',certificate:'Fee-only synthetic certificate',evidence:'Owner recorded the exact limited scope'})
 await refuse({certificateId:feesOnly.id,feeRuleId:''},'TAX_SCOPE')
 const other=await creditAccountFixture(h,'tax-other'),mismatch=await taxDraftFixture(h,other.account,'2')
 await adjust({...input,estimateId:mismatch.q.id,version:mismatch.q.version},{status:409})
 const future=await h.command('tax.certificate',{accountId:account.id,version:account.version,reference:'synthetic-mallet-343',jurisdiction:'Declared fleet district',scope:'parts',validFrom:'2098-01-01',expiresOn:'2099-12-31',certificate:'Future synthetic certificate',evidence:'Future-dated certificate is custody only'})
 await refuse({certificateId:future.id},'TAX_EXPIRED')
 let changed=(await h.state()).records.asset.find(a=>a.id===job.assetId)
 changed=await h.command('customer.linkAsset',{assetId:changed.id,version:changed.version,customerId:other.account.id,customerVersion:other.account.version,reason:'Owner recorded a different current billing relationship'})
 await refuse({},'TAX_ACCOUNT')
 await h.command('customer.linkAsset',{assetId:changed.id,version:changed.version,customerId:account.id,customerVersion:account.version,reason:'Owner restored the original billing relationship for a fresh review'})
 for(const [index,category]of ['disposal','environmental','surcharge'].entries()){
  const feeRule=await h.command('tax.suppliesRule',{...ruleInput,name:category+' fee',category,basis:'parts',rateBps:500,capCents:700,...(category==='environmental'?{mode:'fixed',fixedCents:700}:{})})
  const draft=await taxDraftFixture(h,account,'category-'+index)
  const reviewed=await adjust({estimateId:draft.q.id,version:draft.q.version,feeRuleId:feeRule.id,feeVersion:feeRule.version,consent:true,evidence:'Customer accepted the disclosed '+category+' fee, percentage basis and cap'})
  const revision=reviewed.revisions.at(-1);assert.equal(revision.taxAdjustment.fee.category,category);assert.equal(revision.taxAdjustment.fee.amountCents,700);assert.equal(revision.lines.at(-1).salesTaxCents,53);assert.deepEqual(reviewed.revisions[0],draft.q.revisions[0])
  const billed=await finishTaxInvoice(h,reviewed),issued=await h.command('invoice.issue',{invoiceId:billed.id,version:billed.version,reference:'synthetic-mallet-category-'+index,warrantyTerms:'Reviewed warranty terms',confirm:'issue-invoice'})
  assert.ok(issued.content.includes(category+' fee basis parts $180.00; '+(category==='environmental'?'fixed $7.00':'5%')+'; cap $7.00; fee $7.00'))
 }
 const discountInput={name:'Fleet parts discount',basis:'parts',rateBps:1000,legalBasis:'Owner reviewed the explicit customer discount agreement'}
 await h.command('tax.discountRule',discountInput,{as:admin.cookie,status:403})
 for(const change of [{rateBps:10001},{rateBps:-1},{basis:'inferred'}])await h.command('tax.discountRule',{...discountInput,...change},{status:400})
 const discount=await h.command('tax.discountRule',discountInput),discountDraft=await taxDraftFixture(h,account,'discount')
 const percentFee=await h.command('tax.suppliesRule',{...ruleInput,capCents:10000})
 const discountReview={...input,estimateId:discountDraft.q.id,version:discountDraft.q.version,discountRuleId:discount.id,discountVersion:discount.version,feeRuleId:percentFee.id,feeVersion:percentFee.version}
 await refuse({...discountReview,discountVersion:discount.version+1},'VERSION')
 const discounted=await adjust(discountReview),d=discounted.revisions.at(-1)
 assert.equal(d.taxAdjustment.discount.amountCents,1800);assert.equal(d.lines[0].unitDiscountCents,1900);assert.equal(d.taxAdjustment.fee.baseCents,26200);assert.equal(d.taxAdjustment.fee.amountCents,2620);assert.equal(d.totals.totalCents,29767);assert.deepEqual(discounted.revisions[0],discountDraft.q.revisions[0])
 const discountInvoice=await finishTaxInvoice(h,discounted),discountDocument=await h.command('invoice.issue',{invoiceId:discountInvoice.id,version:discountInvoice.version,reference:'synthetic-mallet-discount',warrantyTerms:'Reviewed warranty terms',confirm:'issue-invoice'})
 assert.ok(discountDocument.content.includes('Discount rule Fleet parts discount; parts; 10% of remaining unit $90.00; added unit discount $9.00'));assert.ok(discountDocument.content.includes('Supplies basis parts and labor $262.00; 10%; cap $100.00; fee $26.20'))
 const tinyDraft=await taxDraftFixture(h,account,'discount-rounding'),tiny=await h.command('estimate.revise',{estimateId:tinyDraft.q.id,version:tinyDraft.q.version,revision:1,lines:[{kind:'part',description:'Fractional discount per unit',quantity:3,unitCents:15}]})
 const rounded=await adjust({estimateId:tiny.id,version:tiny.version,discountRuleId:discount.id,discountVersion:discount.version,consent:true,evidence:'Customer accepted half-up per-unit discount and exact quantity extension'})
 assert.equal(rounded.revisions.at(-1).lines[0].unitDiscountCents,1);assert.equal(rounded.revisions.at(-1).totals.subtotalCents,42,'Remaining 13.5 cents rounds up to 14 cents before quantity three')
 const halfDraft=await taxDraftFixture(h,account,'half-cent'),half=await h.command('estimate.revise',{estimateId:halfDraft.q.id,version:halfDraft.q.version,revision:1,lines:[{kind:'part',description:'Half-cent remaining unit',quantity:1001,unitCents:1}]})
 const halfRule=await h.command('tax.discountRule',{...discountInput,rateBps:5000})
 const halfReview=await adjust({estimateId:half.id,version:half.version,discountRuleId:halfRule.id,discountVersion:halfRule.version,feeRuleId:percentFee.id,feeVersion:percentFee.version,consent:true,evidence:'Customer accepted the disclosed half-cent unit rounding and percentage fee'})
 assert.equal(halfReview.revisions.at(-1).lines[0].unitDiscountCents,0);assert.equal(halfReview.revisions.at(-1).lines[0].subtotalCents,1001,'USD 0.005 remaining rounds up to USD 0.01 before quantity extension');assert.equal(halfReview.revisions.at(-1).taxAdjustment.fee.baseCents,1001);assert.equal(halfReview.revisions.at(-1).taxAdjustment.fee.amountCents,100);assert.deepEqual(halfReview.revisions.at(-1).lines.map(l=>l.salesTaxCents),[75,8]);assert.equal(halfReview.revisions.at(-1).totals.totalCents,1184)
 const uncapped=await h.command('tax.suppliesRule',{...ruleInput,basis:'parts',rateBps:1,capCents:100000})
 const rounding=await h.command('estimate.revise',{estimateId:mismatch.q.id,version:mismatch.q.version,revision:1,lines:[{kind:'part',description:'Half-cent fee basis',quantity:1,unitCents:15000}]})
 const small=await adjust({...input,estimateId:mismatch.q.id,version:rounding.version,certificateId:'',feeRuleId:uncapped.id,feeVersion:uncapped.version})
 assert.equal(small.revisions.at(-1).lines.at(-1).unitCents,2,'An uncapped 1.5 cent fee rounds half up to two cents')
 const adjusted=await adjust(input),rev=adjusted.revisions.at(-1)
 assert.deepEqual(adjusted.revisions[0],original);assert.equal(rev.n,2)
 assert.deepEqual(rev.lines.map(l=>l.salesTaxCents),[0,750,188]);assert.equal(rev.lines[2].unitCents,2500);assert.equal(rev.taxAdjustment.fee.baseCents,28000)
 assert.equal(rev.totals.totalCents,31438);assert.ok(!JSON.stringify(rev).includes(active.certificate))
 await adjust({...input,version:adjusted.version},{status:409})
 const invoice=await finishTaxInvoice(h,adjusted)
 await adjust({...input,version:(await h.state()).records.estimate.find(q=>q.id===adjusted.id).version},{status:409})
 assert.deepEqual(invoice.totals,rev.totals)
 const doc=await h.command('invoice.issue',{invoiceId:invoice.id,version:invoice.version,reference:'synthetic-mallet-342',warrantyTerms:'Shop reviewed warranty terms',confirm:'issue-invoice'})
 assert.match(doc.content,/Owner-applied certificate synthetic-mallet-341/);assert.match(doc.content,/Supplies basis parts and labor \$280.00; 10%; cap \$25.00; fee \$25.00/)
 assert.ok(!doc.content.includes(active.certificate));assert.equal((await h.state({as:admin.cookie})).records.taxFeeRule,undefined)
 await h.command('tax.configure',{ratePercent:20});assert.equal((await h.state()).records.invoice.find(i=>i.id===invoice.id).totals.totalCents,31438)
}

export async function finishTaxInvoice(h,adjusted){
 const rev=adjusted.revisions.at(-1)
 const state=await h.state(),job=state.records.job.find(j=>j.id===adjusted.jobId),asset=state.records.asset.find(a=>a.id===job.assetId),account=state.records.customerAccount?.find(a=>a.id===asset.customerAccountId)
 const fleet=account?.kind==='fleet'?{authorizerId:account.authorizerId,accountVersion:account.version,po:'synthetic-mallet-tax-approval',fleetEvidence:'Owner reviewed the allowed fleet authorizer approval for the exact revised fee and exemption basis'}:{}
 const before=(await h.state()).records
 await h.command('work.record',{jobId:job.id,version:job.version,lineId:rev.lines[0].id,quantity:1},{status:409})
 assert.deepEqual((await h.state()).records,before)
 await h.command('estimate.authorise',{estimateId:adjusted.id,version:adjusted.version,revision:rev.n,lineIds:rev.lines.map(l=>l.id),customerName:'Fleet authorizer',method:'signed',evidence:'Cannot skip renewed approval'},{status:409})
 let next=await h.command('estimate.approve',{estimateId:adjusted.id,version:adjusted.version,revision:rev.n})
 next=await h.command('estimate.markSent',{estimateId:adjusted.id,version:next.version,revision:rev.n,method:'printed'})
 next=await h.command('estimate.authorise',{...fleet,estimateId:adjusted.id,version:next.version,revision:rev.n,lineIds:rev.lines.map(l=>l.id),customerName:'Recorded fleet authorizer',method:'signed',evidence:'Signed authorization to exact disclosed fee and exemption basis'})
 let current=(await h.state()).records.job.find(j=>j.id===adjusted.jobId)
 for(const line of rev.lines)current=await h.command('work.record',{jobId:current.id,version:current.version,lineId:line.id,quantity:line.quantity})
 await qualityReady(h,current);current=await h.command('job.complete',{jobId:current.id,version:current.version})
 let invoice=await h.command('invoice.prepare',{jobId:current.id,version:current.version});return h.command('invoice.approve',{invoiceId:invoice.id,version:invoice.version})
}

export async function taxAccountFixture(h){
 const {account,contact}=await creditAccountFixture(h)
 return {account:await h.command('customer.save',{...account,customerId:account.id,kind:'fleet',name:'Synthetic fleet',authorizerId:contact.id}),contact}
}
