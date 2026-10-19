import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {archive,booking,estimate,installation,restore} from '../harness.mjs'
import {coilDiagnosis,shopSetup} from './diagnosis-journey.mjs'
const canonical=v=>Array.isArray(v)?`[${v.map(canonical).join(',')}]`:v&&typeof v==='object'?`{${Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')}}`:JSON.stringify(v)
export const decide=(h,path,fields,origin=h.origin)=>h.mf.dispatchFetch(h.origin+path,{method:'POST',redirect:'manual',headers:{origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(fields).toString()})
// EST-003: an emailed, expiring link; the customer approves one line, declines another and signs; exactly one decision is kept.
export async function approvalJourney(h,{person=h.person}={}){
 await shopSetup(h)
 const advisor=await person('casey-approve@example.test','admin'),tech=await person('morgan-approve@example.test'),ADV={as:advisor.cookie},T={as:tech.cookie}
 const {asset,job}=await booking(h,{technicianId:tech.id}),version=async id=>(await h.state()).records.job.find(j=>j.id===id).version
 let d=await h.command('diagnosis.record',{jobId:job.id,version:await version(job.id),...coilDiagnosis},T);await h.command('diagnosis.share',{diagnosisId:d.id,version:d.version,revision:1,share:true},ADV)
 let q=await estimate(h,job);q=await h.command('estimate.approve',{estimateId:q.id,version:q.version,revision:1})
 const [pads,labor]=q.revisions[0].lines
 await h.command('approvalLink.create',{estimateId:q.id,version:q.version,revision:1,days:7},{...T,status:403})
 await h.command('estimate.customerDecide',{linkId:'x',approvedLineIds:[],typedName:'Forged',consent:true},{status:404});await h.command('approvalLink.delivery',{linkId:'x',version:1,status:'accepted',provider:'resend'},{status:404})
 const sent=await h.command('approvalLink.create',{estimateId:q.id,version:q.version,revision:1,days:7},ADV)
 assert.equal(sent.delivery.status,'accepted');const mail=h.messages.findLast(m=>JSON.stringify(m.to).includes(asset.customerEmail));assert.ok(mail.text.includes(sent.url),'EST-003 the link is emailed to the customer')
 const path=new URL(sent.url).pathname,token=path.split('/').at(-1),before=await h.state()
 assert.ok(!JSON.stringify(before.records).includes(token),'EST-003 only a token hash is stored');assert.match(before.records.estimate.find(x=>x.id===q.id).sent.at(-1).note,/delivery not confirmed/)
 const view=await h.request(path,{as:''}),html=await view.text();assert.equal(view.status,200)
 for(const shown of ['Brake pads','Replace and tune','$53.75','$180.00','$233.75','Engine shakes at idle','Approving a line authorizes','my typed name is my electronic signature'])assert.ok(html.includes(shown),'EST-003 customer sees '+shown)
 assert.ok(!html.includes('$38.12'),'EST-003 staff notes stay private')
 const choice={['line-'+pads.id]:'approve',['line-'+labor.id]:'decline',typedName:'Dana Brooks',consent:'yes'}
 assert.equal((await decide(h,path,{...choice,['line-'+labor.id]:''})).status,400);assert.equal((await decide(h,path,{...choice,consent:''})).status,400);assert.equal((await decide(h,path,choice,'https://evil.example')).status,403)
 const signed=await decide(h,path,choice),receiptHtml=await signed.text();assert.equal(signed.status,200);assert.match(receiptHtml,/Receipt SHA-256/)
 let state=await h.state(),quote=state.records.estimate.find(x=>x.id===q.id),link=state.records.approvalLink.find(l=>l.id===sent.id)
 assert.equal(quote.status,'authorised');assert.deepEqual(quote.authorisation.lineIds,[pads.id]);assert.equal(quote.authorisation.method,'signed link');assert.equal(quote.authorisation.customerName,'Dana Brooks')
 const r=link.decision.receipt;assert.deepEqual([r.approved.map(l=>l.lineId),r.declined.map(l=>l.lineId)],[[pads.id],[labor.id]]);assert.equal(r.email,asset.customerEmail);assert.equal(r.approvedTotals.totalCents,pads.totalCents)
 assert.equal(link.decision.receiptSha256,createHash('sha256').update(canonical(r)).digest('hex'),'EST-003 the receipt hash covers its exact content')
 const replay=await decide(h,path,choice);assert.equal(replay.status,200);assert.match(await replay.text(),new RegExp(link.decision.receiptSha256))
 assert.equal((await decide(h,path,{...choice,['line-'+labor.id]:'approve'})).status,409)
 assert.deepEqual((await h.state()).records.estimate,state.records.estimate,'EST-003 replays and a second decision change nothing');assert.equal((await h.state()).records.event.filter(e=>e.kind==='estimate.customerDecide').length,1)
 assert.deepEqual(await h.api('/api/mallet/approval-receipts/'+sent.id,undefined,ADV),link.decision);await h.api('/api/mallet/approval-receipts/'+sent.id,undefined,{...T,status:403})
 assert.match(await (await h.request('/app/jobs/'+job.id)).text(),/Signed by Dana Brooks/)
 // A changed price invalidates the old link; revoked links die too.
 const second=(await booking(h,{asset:(await h.state()).records.asset.find(a=>a.id===asset.id),technicianId:tech.id,startAt:'2026-11-03T09:00:00Z',endAt:'2026-11-03T10:00:00Z'})).job
 let q2=await estimate(h,second);q2=await h.command('estimate.approve',{estimateId:q2.id,version:q2.version,revision:1})
 const stale=await h.command('approvalLink.create',{estimateId:q2.id,version:q2.version,revision:1},ADV),stalePath=new URL(stale.url).pathname
 q2=(await h.state()).records.estimate.find(x=>x.id===q2.id)
 q2=await h.command('estimate.revise',{estimateId:q2.id,version:q2.version,revision:1,lines:[{kind:'part',description:'Brake pads',quantity:2,unitCents:2900},{kind:'labor',description:'Replace and tune',quantity:1.5,unitCents:12000}]})
 assert.equal((await h.request(stalePath,{as:''})).status,404);const late=await decide(h,stalePath,{['line-'+q2.revisions[0].lines[0].id]:'approve',['line-'+q2.revisions[0].lines[1].id]:'approve',typedName:'Dana Brooks',consent:'yes'});assert.equal(late.status,404)
 q2=await h.command('estimate.approve',{estimateId:q2.id,version:q2.version,revision:2});const fresh2=await h.command('approvalLink.create',{estimateId:q2.id,version:q2.version,revision:2},ADV)
 await h.command('approvalLink.revoke',{linkId:fresh2.id,version:fresh2.version},ADV);assert.equal((await h.request(new URL(fresh2.url).pathname,{as:''})).status,404)
 assert.equal((await h.state()).records.estimate.find(x=>x.id===q2.id).authorisation,null,'EST-003 stale and revoked links record nothing')
 const key=await h.command('agent.create',{label:'Approval boundary'});assert.equal((await h.state({as:'',headers:{authorization:`Bearer ${key.token}`}})).records.approvalLink,undefined)
 // OPS-001: decisions and receipts restore exactly; link credentials do not.
 state=await h.state();const backup=await archive(h),target=await installation()
 try{await restore(target,backup);const restored=await target.state();assert.deepEqual(restored.records.approvalLink,state.records.approvalLink);assert.deepEqual(restored.records.estimate,state.records.estimate);assert.equal((await target.request(path,{as:''})).status,404);assert.deepEqual(await target.api('/api/mallet/approval-receipts/'+sent.id),link.decision)}finally{await target.close()}
 return {advisor,job}
}
