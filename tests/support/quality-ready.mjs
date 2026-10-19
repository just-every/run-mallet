import assert from 'node:assert/strict'
// Ordinary public commands replace the former completion-only path. Callers
// still invoke job.complete themselves and keep their original assertions.
export async function qualityReady(h,job,{technician,reviewer}={}) {
 const actor=(await h.state()).actor
 if(!technician){assert.equal(job.technicianId,actor.id,'QUALITY-001 fixture has a current native technician');technician={id:actor.id,cookie:h.owner}}
 reviewer??=await h.person('quality-'+job.id+'@example.test','admin')
 let q=(await h.state()).records.quality?.find(q=>q.jobId===job.id)
 const send=(command,more={},options={})=>h.command(command,{jobId:job.id,version:job.version,qualityVersion:q?.version??0,...more},options)
 q=await send('quality.configure',{reason:'Pre/post acceptance checks for this repair',items:[{label:'Pre-work condition and requested scope',stage:'pre',required:true,critical:false},{label:'Post-work function check',stage:'post',required:true,critical:true}]})
 for(const item of q.revisions.at(-1).items)q=await send('quality.record',{itemId:item.id,outcome:'pass',note:'Qualified technician performed this check and recorded the result'},{as:technician.cookie})
 q=await send('quality.signTechnician',{qualification:'Qualified repair technician',note:'Inspected current actual work and recorded tests'},{as:technician.cookie})
 q=await send('quality.signQuality',{qualification:'Independent qualified shop quality reviewer',note:'Reviewed and independently inspected this repair',safetyDecision:'safe'},{as:reviewer.cookie})
 return q
}
