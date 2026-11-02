import {shopSetup} from './diagnosis-journey.mjs'
import assert from 'node:assert/strict'
import {booking,authorise,archive,restore,installation} from '../harness.mjs'
import {qualityReady} from './quality-ready.mjs'

export async function estimatePricingJourney(h){
 await shopSetup(h)
 const tech=await h.person('pricing-technician@example.test'),advisor=await h.person('pricing-advisor@example.test','admin')
 const key=await h.command('agent.create',{label:'Pricing preparation'}),agent={as:'',headers:{authorization:`Bearer ${key.token}`}}
 const profileInput={version:0,name:'Metro fleet',kind:'fleet',laborRateCents:10000,reason:'Agreed fleet hourly price'}
 for(const options of [{as:tech.cookie,status:403},{...agent,status:403},{as:'',status:401},{headers:{origin:'https://other.test'},status:403}])await h.command('rateProfile.save',profileInput,options)
 let profile=await h.command('rateProfile.save',profileInput)
 const customer=await h.command('rateProfile.save',{...profileInput,name:'Household standard',kind:'customer',laborRateCents:12000},{as:advisor.cookie})
 assert.equal(customer.revisions[0].kind,'customer','EST-001 named customer and fleet profiles are independently saved')
 const {job}=await booking(h,{technicianId:tech.id})
 await h.command('tax.configure',{ratePercent:7.5,partsTaxable:true,laborTaxable:false})
 const lines=[{kind:'part',description:'Brake pads',quantity:2,unitCents:5000,costCents:3000,unitDiscountCents:500},{kind:'labor',description:'Brake replacement',quantity:2.5,unitCents:15000,unitDiscountCents:1000},{kind:'fee',description:'Disposal',quantity:1,unitCents:1250,feeTaxable:true}]
 const input={jobId:job.id,version:job.version,rateProfileId:profile.id,rateProfileVersion:profile.version,lines}
 await h.command('estimate.prepare',{...input,lines:[{...lines[0],unitDiscountCents:5001}]},{status:400})
 await h.command('estimate.prepare',{...input,lines:[{...lines[2],feeTaxable:undefined}]},{status:400})
 await h.command('estimate.prepare',{...input,lines:[{...lines[0],costCents:-1}]},{status:400})
 await h.command('estimate.prepare',{...input,rateProfileVersion:profile.version+1},{status:409})
 let q=await h.command('estimate.prepare',input),revision=structuredClone(q.revisions[0])
 assert.deepEqual(revision.totals,{currency:'USD',subtotalCents:32750,salesTaxCents:769,totalCents:33519},'EST-001 independent arithmetic: 2×($50−$5) + 2.5×($100−$10) + $12.50; parts/fee tax rounds half up per line')
 assert.equal(revision.lines[0].costCents,3000);assert.equal(revision.lines[1].unitCents,10000);assert.equal(revision.lines[1].taxable,false)
 assert.equal(revision.rateProfile.snapshot.name,'Metro fleet')
 profile=await h.command('rateProfile.save',{...profileInput,id:profile.id,version:profile.version,laborRateCents:11000,reason:'Next-period rate'})
 await h.command('rateProfile.save',{...profileInput,id:profile.id,version:1},{status:409})
 assert.equal(profile.revisions.length,2)
 q=await authorise(h,q)
 const acceptedRevision=structuredClone(q.revisions[0])
 await h.command('tax.configure',{ratePercent:9,partsTaxable:false,laborTaxable:true})
 for(const line of revision.lines){const j=(await h.state()).records.job.find(j=>j.id===job.id);await h.command('work.record',{jobId:job.id,version:j.version,lineId:line.id,quantity:line.quantity},{as:tech.cookie})}
 let j=(await h.state()).records.job.find(j=>j.id===job.id)
 assert.deepEqual(j.actuals.map(a=>a.lineId).sort(),revision.lines.map(l=>l.id).sort(),'EST-001 actuals reference authorized lines without rekeyed prices')
 await qualityReady(h,j,{technician:tech});j=(await h.state()).records.job.find(j=>j.id===job.id)
 j=await h.command('job.complete',{jobId:job.id,version:j.version})
 let invoice=await h.command('invoice.prepare',{jobId:j.id,version:j.version})
 assert.deepEqual(invoice.totals,revision.totals,'EST-001 changing tax/rate rules never reprices accepted actuals')
 for(let i=0;i<3;i++){assert.equal(invoice.lines[i].unitDiscountCents,revision.lines[i].unitDiscountCents);assert.equal(invoice.lines[i].totalCents,revision.lines[i].totalCents)}
 assert.deepEqual(invoice.sources[0].rateProfile,revision.rateProfile)
 invoice=await h.command('invoice.approve',{invoiceId:invoice.id,version:invoice.version,revision:1})
 const tender={jobId:job.id,invoiceId:invoice.id,version:invoice.version,invoiceRevision:invoice.revision,method:'cash',amountCents:10000,reference:'synthetic-mallet-231',evidence:'Counter staff counted this partial cash tender'}
 const balancePage=async()=>{const response=await h.request('/app/jobs/'+job.id);assert.equal(response.status,200);return response.text()}
 assert.match(await balancePage(),/Balance due \$335\.19/)
 await h.command('payment.record',tender)
 assert.match(await balancePage(),/Recorded tender net of refunds and account credit \$100\.00[\s\S]*Balance due \$235\.19/)
 await h.command('payment.record',{...tender,amountCents:23520,reference:'synthetic-mallet-232'},{status:409})
 await h.command('payment.record',{...tender,amountCents:23519,reference:'synthetic-mallet-232'})
 assert.match(await balancePage(),/Balance due \$0\.00/)
 assert.deepEqual((await h.state()).records.invoice.find(i=>i.id===invoice.id).totals,revision.totals,'Tender allocations never reprice the accepted invoice')
 const exported=await h.command('invoice.export',{invoiceId:invoice.id,version:invoice.version})
 const csv=await (await h.request('/api/mallet/exports/'+exported.id)).text()
 assert.match(csv,/"45.00","90.00","6.75","96.75"/);assert.match(csv,/"90.00","225.00","0.00","225.00"/)
 assert.deepEqual((await h.state()).records.estimate[0].revisions[0],acceptedRevision,'EST-001 the exact original quote remains frozen')
 await h.api('/auth/operator/status',{operatorId:advisor.id,status:'inactive'})
 const additional=await booking(h,{asset:(await h.state()).records.asset[0],technicianId:tech.id,bayId:'Pricing second bay',startAt:'2026-12-03T09:00:00Z',endAt:'2026-12-03T10:00:00Z'})
 const household=await h.command('estimate.prepare',{jobId:additional.job.id,version:additional.job.version,rateProfileId:customer.id,rateProfileVersion:customer.version,lines:[{kind:'labor',description:'Household labor',quantity:.333,unitCents:1,unitDiscountCents:1},{kind:'fee',description:'Exempt handling',quantity:1,unitCents:100,feeTaxable:false}]})
 assert.equal(household.revisions[0].rateProfile.snapshot.kind,'customer')
 assert.equal(household.revisions[0].lines[0].subtotalCents,3996,'EST-001 customer profile: .333 × ($120.00 − $.01) rounds $39.95667 half up to $39.96')
 assert.equal(household.revisions[0].lines[0].salesTaxCents,360,'EST-001 the later taxable-labor setting rounds $3.5964 half up to $3.60')
 assert.equal(household.revisions[0].lines[1].salesTaxCents,0,'EST-001 explicit fee exemption is frozen separately from parts/labor taxability')
 const saved=await archive(h),fresh=await installation({bindings:{OWNER_EMAIL:'new-pricing-owner@example.test'}})
 try{await restore(fresh,saved);const before=await h.state(),after=await fresh.state();for(const kind of ['rateProfile','estimate','invoice','payment','export'])assert.deepEqual(after.records[kind],before.records[kind],'EST-001 / OPS-001 exact pricing, consent and invoice evidence restores');await fresh.state({as:advisor.cookie,status:401})}finally{await fresh.close()}
}
