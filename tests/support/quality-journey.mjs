import assert from 'node:assert/strict'
import {booking,estimate,authorise,archive,installation,restore} from '../harness.mjs'
export async function qualityJourney(h){
 const tech=await h.person('brake-tech@example.test'),other=await h.person('unassigned-tech@example.test')
 const {job}=await booking(h,{technicianId:tech.id});let quote=await authorise(h,await estimate(h,job)),current=(await h.state()).records.job.find(j=>j.id===job.id)
 current=await h.command('work.record',{jobId:job.id,version:current.version,lineId:quote.revisions[0].lines[1].id,quantity:.5,note:'Initial authorized brake work'},{as:tech.cookie})
 assert.equal((await h.command('job.complete',{jobId:job.id,version:current.version},{status:409})).error,'QUALITY_BLOCKED')
 let q
 const send=(command,more={},options={})=>h.command(command,{jobId:job.id,version:current.version,qualityVersion:q?.version??0,...more},options)
 const items=[{label:'Pre-work brake condition',stage:'pre',critical:false,required:true},{label:'Post-repair brake function',stage:'post',critical:true,required:true},{label:'Road-test stopping distance',stage:'road-test',critical:true,required:true,measurement:{label:'Stopping distance',unit:'ft'}}]
 await send('quality.configure',{items,reason:'Brake repair plan'},{as:tech.cookie,status:403})
 q=await send('quality.configure',{items,reason:'Brake repair plan'})
 const originalRevision=structuredClone(q.revisions[0]),[pre,post,road]=q.revisions[0].items
 await send('quality.record',{itemId:pre.id,outcome:'pass',note:'Unauthorized coworker'},{as:other.cookie,status:403})
 q=await send('quality.record',{itemId:pre.id,outcome:'pass',note:'Intake brake condition recorded'},{as:tech.cookie})
 q=await send('quality.record',{itemId:road.id,outcome:'pass',measurementValue:45,measurementUnit:'ft',note:'Qualified technician measured controlled road test'},{as:tech.cookie})
 q=await send('quality.record',{itemId:post.id,outcome:'fail',note:'Brake pedal remains soft after initial work'},{as:tech.cookie});const failed=q.results.at(-1)
 await send('quality.record',{itemId:post.id,outcome:'pass',note:'No corrective work recorded'},{as:tech.cookie,status:409})
 const signTech=()=>send('quality.signTechnician',{qualification:'Qualified brake technician',note:'Personally performed the current checks and reviewed the recorded work'},{as:tech.cookie})
 const signQuality=(safetyDecision='safe',options={})=>send('quality.signQuality',{qualification:'Qualified independent shop manager',note:'Independent physical inspection and current evidence review',safetyDecision},options)
 q=await signTech();q=await signQuality('unsafe')
 await signQuality('safe',{status:409});await h.command('job.complete',{jobId:job.id,version:current.version},{status:409})
 const oldActual=current.actuals[0]
 await send('quality.correct',{failedResultId:failed.id,workId:oldActual.id,reason:'This predates the failed test'},{as:tech.cookie,status:400})
 current=await h.command('work.record',{jobId:job.id,version:current.version,lineId:quote.revisions[0].lines[1].id,quantity:.5,note:'Bled brakes to correct soft pedal'},{as:tech.cookie})
 q=await send('quality.correct',{failedResultId:failed.id,workId:current.actuals.at(-1).id,reason:'Bled brake circuit and inspected for leaks'},{as:tech.cookie})
 q=await send('quality.record',{itemId:post.id,outcome:'pass',note:'Pedal firm and brake function verified after corrective work'},{as:tech.cookie})
 q=await signTech();q=await signQuality()
 current=await h.command('work.record',{jobId:job.id,version:current.version,lineId:quote.revisions[0].lines[1].id,quantity:.25,note:'Final authorized cable adjustment'},{as:tech.cookie})
 assert.equal((await h.command('job.complete',{jobId:job.id,version:current.version},{status:409})).error,'QUALITY_BLOCKED')
 q=await signTech();q=await signQuality()
 assert.deepEqual(q.results.find(r=>r.id===failed.id),failed);assert.equal(q.corrections[0].work.note,'Bled brakes to correct soft pedal')
 assert.equal((await h.state({as:other.cookie})).records.quality.length,0)
 assert.equal((await h.state({as:tech.cookie})).records.quality[0].id,q.id)
 // New plan revision and explicit override leave all failed/corrected evidence intact.
 q=await send('quality.configure',{items:[items[0],{...items[1],label:'Post-work pedal and lug torque'},items[2]],reason:'Add explicit lug torque check'})
 assert.deepEqual(q.revisions[0],originalRevision)
 await h.command('job.complete',{jobId:job.id,version:current.version},{status:409})
 const revised=q.revisions.at(-1).items
 q=await send('quality.record',{itemId:revised[0].id,outcome:'pass',note:'Rechecked condition for revised plan'},{as:tech.cookie})
 q=await send('quality.record',{itemId:revised[1].id,outcome:'fail',note:'Second inspector required for unusual brake configuration'},{as:tech.cookie})
 q=await signTech()
 const waived=[revised[1].id,revised[2].id]
 await send('quality.override',{itemIds:waived,reason:'',qualification:'Qualified brake manager',safetyDecision:'safe'},{status:400})
 await send('quality.override',{itemIds:waived,reason:'Coworker cannot waive',qualification:'Technician',safetyDecision:'safe'},{as:other.cookie,status:403})
 q=await send('quality.override',{itemIds:waived,reason:'Qualified manager independently performed alternate controlled stopping/torque assessment; standard test configuration unavailable',qualification:'Qualified independent brake manager',safetyDecision:'safe'})
 q=await signQuality()
 const key=await h.command('agent.create',{label:'No safety authority'}),agent={as:'',headers:{authorization:'Bearer '+key.token},status:403}
 for(const command of ['quality.configure','quality.record','quality.correct','quality.signTechnician','quality.signQuality','quality.override','quality.takeover'])await send(command,{},agent)
 const complete=await h.command('job.complete',{jobId:job.id,version:current.version});assert.equal(complete.status,'completed')
 const backup=await archive(h),fresh=await installation({bindings:{OWNER_EMAIL:'quality-recovery@example.test'}})
 try{await restore(fresh,backup);assert.deepEqual((await fresh.state()).records.quality.find(r=>r.id===q.id),q);assert.equal(q.results.find(r=>r.id===failed.id).outcome,'fail');assert.equal(q.overrides.length,1);assert.ok(q.signoffs.some(s=>s.safetyDecision==='unsafe'));await fresh.state({as:tech.cookie,status:401})}finally{await fresh.close()}
}
