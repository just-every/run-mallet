import assert from 'node:assert/strict'
import {installation,archive,restore} from '../harness.mjs'
import {creditAccountFixture,creditInvoice,creditInput,issueCredit} from './refunds-journey.mjs'
export async function taxCustodyJourney(){
 const h=await installation()
 try{
  const {account}=await creditAccountFixture(h),{invoice}=await creditInvoice(h,account),admin=await h.person('certificate-admin@example.test','admin')
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
  const records=(await h.state()).records,fresh=await installation({bindings:{OWNER_EMAIL:'tax-custody-recovery@example.test'}})
  try{await restore(fresh,await archive(h));for(const kind of ['taxCertificate','taxJurisdiction','invoice','creditNote'])assert.deepEqual((await fresh.state()).records[kind],records[kind]);assert.deepEqual(await fresh.api('/api/mallet/tax/report'),report);assert.equal(fresh.messages.length,0)}finally{await fresh.close()}
 }finally{await h.close()}
}
