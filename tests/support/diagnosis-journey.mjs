import assert from 'node:assert/strict'
import {archive,authorise,booking,estimate,installation,restore} from '../harness.mjs'
import {inspectionPhoto} from './inspection-photo.mjs'
export const coilDiagnosis={complaint:'Engine shakes at idle',cause:'Cylinder 1 ignition coil failed',correction:'Replace cylinder 1 ignition coil',testMethod:'Swapped coils 1 and 3; the misfire followed the coil',staffNote:'Coil costs us $38.12 from the supplier',customerExplanation:'The ignition coil for cylinder 1 has failed, so that cylinder misfires.'}
export async function shopSetup(h){const r=await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',redirect:'manual',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes&ratePercent=7.5&partsTaxable=yes'});assert.equal(r.status,303)}
// DIAG-001: structured diagnostics with staff-only notes; the customer link shows only explicitly shared revisions.
export async function diagnosisJourney(h,{person=h.person}={}){
 await shopSetup(h)
 const tech=await person('dana-diag@example.test'),other=await person('lee-diag@example.test'),advisor=await person('alex-advisor-diag@example.test','admin'),T={as:tech.cookie},ADV={as:advisor.cookie}
 const {job}=await booking(h,{technicianId:tech.id}),quote=await authorise(h,await estimate(h,job)),photo=await inspectionPhoto(h,job.id,tech.cookie,'Misfire coil')
 const version=async()=>(await h.state()).records.job.find(j=>j.id===job.id).version
 const entry={...coilDiagnosis,dtcs:[{code:'P0301',description:'Cylinder 1 misfire'},{code:'P0300',description:''}],measurements:[{name:'Compression cylinder 1',value:165,unit:'psi'},{name:'Coil primary resistance',value:0.4,unit:'ohm'}],attachmentIds:[photo.id]}
 await h.command('diagnosis.record',{jobId:job.id,version:await version(),...entry,attachmentIds:[]},{as:other.cookie,status:403});await h.command('diagnosis.record',{jobId:job.id,version:await version(),...entry},{as:other.cookie,status:404})
 await h.command('diagnosis.record',{jobId:job.id,version:await version(),...entry,dtcs:[{code:'p0301'}]},{...T,status:400})
 let d=await h.command('diagnosis.record',{jobId:job.id,version:await version(),...entry},T)
 assert.deepEqual(d.revisions[0].dtcs.map(x=>x.code),['P0301','P0300']);assert.deepEqual(d.revisions[0].measurements[1],{name:'Coil primary resistance',value:0.4,unit:'ohm'},'DIAG-001 exact value and unit, no conversion')
 assert.equal(d.revisions[0].attachments[0].sha256,photo.sha256,'DIAG-001 attachments bind completed media from this repair')
 const forged=await h.command('diagnosis.record',{jobId:job.id,version:await version(),complaint:'Unshared rattle note',attachments:[{id:'forged',jobId:job.id,filename:'forged.png'}]},T)
 assert.deepEqual(forged.revisions[0].attachments,[],'DIAG-001 caller-supplied attachment snapshots are ignored')
 await h.command('diagnosis.share',{diagnosisId:d.id,version:d.version,revision:1,share:true},{...T,status:403})
 d=await h.command('diagnosis.record',{jobId:job.id,version:await version(),diagnosisId:d.id,diagnosisVersion:d.version,...entry,customerExplanation:'Your cylinder 1 ignition coil has failed; replacing it stops the misfire.'},T)
 d=await h.command('diagnosis.share',{diagnosisId:d.id,version:d.version,revision:2,share:true},ADV)
 d=await h.command('diagnosis.record',{jobId:job.id,version:await version(),diagnosisId:d.id,diagnosisVersion:d.version,...entry,customerExplanation:'UNREVIEWED draft explanation'},T)
 assert.equal(d.revisions.length,3);assert.equal(d.shared.revision,2,'DIAG-001 a later revision stays private until an advisor shares it')
 await h.command('diagnosisLink.create',{jobId:job.id},{...T,status:403});await h.command('diagnosisLink.create',{jobId:job.id,days:32},{status:400})
 const link=await h.command('diagnosisLink.create',{jobId:job.id,days:7}),path=new URL(link.url).pathname,before=await h.state()
 assert.equal(link.sentByMallet,false);assert.ok(!JSON.stringify(before.records.diagnosisLink).includes(path.split('/').at(-1)),'DIAG-001 only a hash of the token is stored')
 const view=await h.request(path,{as:''}),html=await view.text()
 assert.equal(view.status,200);assert.equal(view.headers.get('referrer-policy'),'no-referrer')
 for(const shown of ['P0301','Cylinder 1 misfire','Compression cylinder 1: 165 psi','Coil primary resistance: 0.4 ohm','Swapped coils 1 and 3','Your cylinder 1 ignition coil has failed','does not approve or decline'])assert.ok(html.includes(shown),'DIAG-001 shared finding appears: '+shown)
 for(const hidden of ['$38.12','Coil costs us','UNREVIEWED','Unshared rattle note','misfire-coil.png','Cedar Bikes','cedar@example.test','$120.00','Morgan Workshop'])assert.ok(!html.includes(hidden),'DIAG-001 private content stays out of the customer link: '+hidden)
 const after=await h.state()
 assert.deepEqual(after.records.estimate,before.records.estimate,'DIAG-001 a customer view changes no approval');assert.deepEqual(after.records.approval,before.records.approval)
 assert.equal(after.records.diagnosisLinkView.filter(v=>v.linkId===link.id).length,1,'DIAG-001 the view is receipted')
 const unknown=await h.request('/inspection/'+'A'.repeat(43),{as:''});assert.equal(unknown.status,404);const unknownText=await unknown.text()
 assert.equal((await h.request('/inspection/short',{as:''})).status,404);assert.equal((await h.request(path,{as:'',method:'POST',body:{}})).status,405)
 // Agents and unassigned staff never receive diagnostic notes.
 const key=await h.command('agent.create',{label:'Diagnosis boundary'}),agent={as:'',headers:{authorization:`Bearer ${key.token}`}},agentState=await h.state(agent)
 assert.equal(agentState.records.diagnosis,undefined);assert.equal(agentState.records.diagnosisLink,undefined);await h.command('diagnosis.record',{jobId:job.id,version:await version(),...coilDiagnosis},{...agent,status:403})
 assert.equal((await h.state({as:other.cookie})).records.diagnosis.length,0);assert.equal((await h.state(T)).records.diagnosis.length,2)
 const techPage=await (await h.request('/app/jobs/'+job.id,T)).text();assert.match(techPage,/Staff only:<\/strong> Coil costs us \$38\.12/);assert.doesNotMatch(techPage,/Create customer inspection link/)
 const ownerPage=await (await h.request('/app/jobs/'+job.id)).text();assert.match(ownerPage,/Not sent by Mallet · 1 view/)
 await h.command('diagnosisLink.revoke',{linkId:link.id,version:after.records.diagnosisLink.find(l=>l.id===link.id).version},ADV)
 const revoked=await h.request(path,{as:''});assert.equal(revoked.status,404);assert.equal(await revoked.text(),unknownText,'DIAG-001 revoked and unknown links look the same')
 assert.deepEqual((await h.state()).records.estimate.find(q=>q.id===quote.id),before.records.estimate.find(q=>q.id===quote.id))
 // OPS-001: diagnoses, link history and receipts restore; link credentials do not.
 const fresh=await installation(),shared=await h.command('diagnosisLink.create',{jobId:job.id,days:7}),state=await h.state(),backup=await archive(h)
 try{await restore(fresh,backup);const restored=await fresh.state();for(const kind of ['diagnosis','diagnosisLink','diagnosisLinkView'])assert.deepEqual(restored.records[kind],state.records[kind]);assert.equal((await fresh.request(new URL(shared.url).pathname,{as:''})).status,404)}finally{await fresh.close()}
 return {tech,advisor,job,photo}
}
