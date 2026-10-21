import {custodyInput} from './intake-journey.mjs'
// Public native prerequisites for an explicit owner-approved unpaid handover.
// The fixture never asserts a cash entry or screenshot is processor settlement.
export async function handoverInput(h,jobId,collectorName){
 let state=await h.state(),job=state.records.job.find(j=>j.id===jobId),delegateId=''
 if(collectorName.toLowerCase()!==job.asset.customerName.toLowerCase())delegateId=(await h.command('return.delegate',{jobId,version:job.version,customerName:job.asset.customerName,delegateName:collectorName,evidence:'Customer explicitly authorized this named collector for the fixture repair',consent:true})).id
 const intake=await h.command('intake.record',{...custodyInput(job),items:[{kind:'key',label:'Vehicle key',quantity:1}],signedBy:job.asset.customerName})
 job=(await h.state()).records.job.find(j=>j.id===jobId)
 const comparison=await h.command('intake.compare',{jobId,version:job.version,intakeId:intake.id,returned:intake.items.map(i=>({itemId:i.id,quantity:i.quantity})),signedBy:collectorName,consent:true})
 job=(await h.state()).records.job.find(j=>j.id===jobId)
 let reading=(await h.state()).records.reading?.find(r=>r.jobId===jobId&&r.stage==='out')
 if(!reading)reading=await h.command('reading.record',{jobId,version:job.version,stage:'out',value:65000,unit:'miles',observedAt:new Date(Date.now()-1000).toISOString()})
 job=(await h.state()).records.job.find(j=>j.id===jobId)
 const override=await h.command('return.override',{jobId,version:job.version,reason:'Owner explicitly permits this fixture handover without verified processor settlement; no payment is inferred'})
 state=await h.state();return {jobId,version:job.version,flowVersion:state.records.flow?.find(f=>f.jobId===jobId)?.version??0,collectorName,delegateId,comparisonId:comparison.id,readingId:reading.id,overrideId:override.id,identityEvidence:'Staff checked the named collector in person; no identity document retained',warrantyAdvice:'Shop warranty terms provided; contact the shop for covered symptoms and a paper receipt.'}
}
