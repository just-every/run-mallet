import {downloadWorkbook} from './report-xlsx.mjs'
import {downloadReport} from './report-csv.mjs'
import assert from 'node:assert/strict'
import {archive,authorise,estimate,installation,restore} from '../harness.mjs'
const day=ms=>new Date(ms).toISOString().slice(0,10)
const totals=r=>({attendanceMs:r.attendanceMs,breakMs:r.breakMs,netAttendanceMs:r.netAttendanceMs,billableMs:r.billableMs,nonbillableMs:r.nonbillableMs,reworkMs:r.reworkMs,jobMs:r.jobMs,soldMilliHours:r.soldMilliHours,efficiencyTenths:r.efficiencyTenths,productivityTenths:r.productivityTenths})
// REPORT-003: two technicians clock billable and rework jobs; the report recomputes from clock events and corrections.
export async function reportJourney(h,{person=h.person}={}){
 const a=await person('riley-report@example.test'),b=await person('jordan-report@example.test'),advisor=await person('casey-advisor@example.test','admin'),A={as:a.cookie},B={as:b.cookie},ADV={as:advisor.cookie}
 const setup=await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',redirect:'manual',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes&ratePercent=7.5&partsTaxable=yes'});assert.equal(setup.status,303)
 const book=async(technicianId,n,bayId,startAt,endAt)=>{const asset=await h.command('asset.create',{customerName:'Report Fleet',customerEmail:'fleet@example.test',label:'Ford Transit '+n,identifier:'RPT-'+n});return h.command('job.book',{assetId:asset.id,version:asset.version,title:'Brake service '+n,technicianId,bayId,startAt,endAt})}
 const one=await book(a.id,'1','Bay 1','2026-11-02T09:00:00Z','2026-11-02T11:00:00Z'),two=await book(a.id,'2','Bay 2','2026-11-02T12:00:00Z','2026-11-02T13:00:00Z'),three=await book(b.id,'3','Bay 3','2026-11-02T09:00:00Z','2026-11-02T12:00:00Z')
 await authorise(h,await h.command('estimate.prepare',{jobId:one.id,version:one.version,lines:[{kind:'part',description:'Brake pads',quantity:2,unitCents:2500},{kind:'labor',description:'=HYPERLINK("example"),\nreplace and tune',quantity:1.5,unitCents:12000}]}));await authorise(h,await estimate(h,three))
 const job=async id=>(await h.state()).records.job.find(j=>j.id===id),entry=async id=>(await h.state()).records.timeEntry.find(e=>e.id===id)
 const start=async(j,category,as)=>h.command('time.start',{jobId:j.id,version:(await job(j.id)).version,category},as)
 const clockA=await h.command('time.clockIn',{},A),billA=await start(one,'billable',A);await h.command('time.pause',{jobId:one.id},A)
 const reworkA=await start(two,'rework',A);await h.command('time.pause',{jobId:two.id},A)
 const breakA=await h.command('time.breakStart',{},A);await h.command('time.breakEnd',{},A);await h.command('time.clockOut',{},A)
 const clockB=await h.command('time.clockIn',{},B),billB=await start(three,'billable',B);await h.command('time.pause',{jobId:three.id},B);await h.command('time.clockOut',{},B)
 const endA=Date.parse((await entry(clockA.id)).revisions.at(-1).endAt),endB=Date.parse((await entry(clockB.id)).revisions.at(-1).endAt)
 const propose=async(id,as,end,from,to,reason)=>{const e=await entry(id);return h.command('time.correct',{entryId:id,entryVersion:e.version,startAt:new Date(end-from*1000).toISOString(),endAt:new Date(end-to*1000).toISOString(),reason},as)}
 const approve=c=>h.command('time.approveCorrection',{correctionId:c.id,correctionVersion:c.version})
 for(const [id,from,to,reason] of [[clockA.id,28800,0,'Shift started at opening'],[billA.id,25200,18000,'Brake job ran two hours'],[breakA.id,18000,16200,'Thirty minute lunch'],[reworkA.id,14400,10800,'Comeback rework took one hour']])await approve(await propose(id,A,endA,from,to,reason))
 for(const [id,from,to,reason] of [[clockB.id,14400,0,'Half shift'],[billB.id,12600,1800,'Brake job ran three hours']])await approve(await propose(id,B,endB,from,to,reason))
 const q=`?from=${day(Date.now()-86400000)}&to=${day(Date.now())}`,report=(options={})=>h.api('/api/mallet/reports/technicians'+q,undefined,options),row=(r,id)=>r.technicians.find(t=>t.technicianId===id)
 let r=await report()
 assert.deepEqual(totals(row(r,a.id)),{attendanceMs:28800000,breakMs:1800000,netAttendanceMs:27000000,billableMs:7200000,nonbillableMs:0,reworkMs:3600000,jobMs:10800000,soldMilliHours:1500,efficiencyTenths:750,productivityTenths:400},'REPORT-003 sold 1.5 h over 2 h billable is 75.0%; 3 h of jobs over 7.5 h net attendance is 40.0%')
 assert.deepEqual(totals(row(r,b.id)),{attendanceMs:14400000,breakMs:0,netAttendanceMs:14400000,billableMs:10800000,nonbillableMs:0,reworkMs:0,jobMs:10800000,soldMilliHours:1500,efficiencyTenths:500,productivityTenths:750})
 // Payroll-sensitive rates: owner-only, dated, retained revisions.
 const yesterday=day(Date.now()-86400000),tomorrow=day(Date.now()+86400000)
 let rate=await h.command('payRate.set',{technicianId:a.id,centsPerHour:3000,effectiveFrom:yesterday,reason:'Hourly technician wage'})
 rate=await h.command('payRate.set',{technicianId:a.id,version:rate.version,centsPerHour:4000,effectiveFrom:tomorrow,reason:'Raise from next pay period'})
 await h.command('payRate.set',{technicianId:a.id,version:1,centsPerHour:1,effectiveFrom:yesterday,reason:'Stale edit'},{status:409})
 await h.command('payRate.set',{technicianId:b.id,centsPerHour:2500,effectiveFrom:yesterday,reason:'Advisor tries to set wages'},{...ADV,status:403})
 await h.command('payRate.set',{technicianId:a.id,centsPerHour:9900,effectiveFrom:yesterday,reason:'Technician tries to set wages'},{...A,status:403})
 r=await report()
 assert.equal(row(r,a.id).payCents,22500,'REPORT-003 7.5 h net attendance at $30.00/h; the future rate does not apply');assert.equal(row(r,a.id).unratedMs,0);assert.equal(row(r,a.id).rates.revisions.length,2)
 assert.equal(row(r,b.id).payCents,0);assert.equal(row(r,b.id).unratedMs,14400000)
 const adv=await report(ADV),mine=await report(A)
 assert.deepEqual(adv.technicians.map(totals),r.technicians.map(totals),'REPORT-003 advisors read every technician’s hours')
 assert.doesNotMatch(JSON.stringify(adv),/payCents|unratedMs|centsPerHour|rates/,'REPORT-003 advisors never receive payroll rates')
 assert.equal((await h.state(ADV)).records.payRate,undefined);assert.equal((await h.state(A)).records.payRate,undefined)
 assert.deepEqual(mine.technicians.map(t=>t.technicianId),[a.id],'REPORT-003 a technician reads only their own row');assert.doesNotMatch(JSON.stringify(mine),/payCents|centsPerHour|rates/)
 const key=await h.command('agent.create',{label:'Report boundary'}),agent={as:'',headers:{authorization:`Bearer ${key.token}`}}
 await report({...agent,status:403});assert.equal((await h.request('/app/reports/technicians'+q,agent)).status,403);assert.equal((await h.request('/app/reports/technicians',{as:''})).status,303)
 // Adjust one timer: a pending proposal changes nothing; the approved correction recomputes the report.
 const shorter=await propose(billA.id,A,endA,25200,21600,'Paper ticket shows brake job ended after one hour')
 assert.equal(row(await report(),a.id).billableMs,7200000,'REPORT-003 pending corrections do not change the report')
 await approve(shorter);r=await report()
 assert.deepEqual(totals(row(r,a.id)),{attendanceMs:28800000,breakMs:1800000,netAttendanceMs:27000000,billableMs:3600000,nonbillableMs:0,reworkMs:3600000,jobMs:7200000,soldMilliHours:1500,efficiencyTenths:1500,productivityTenths:267},'REPORT-003 recomputed: 1.5 sold over 1 h is 150.0%; 2 h over 7.5 h is 26.7% half-up')
 assert.equal(row(r,a.id).payCents,22500,'REPORT-003 job corrections leave attendance cost unchanged')
 // Drill-through to the timer, its edits and assignments.
 const j2=await job(two.id),move=await h.command('dispatch.prepare',{jobId:two.id,version:j2.version,technicianId:b.id,bayId:'Bay 2',startAt:j2.startAt,endAt:j2.endAt,reason:'Specialist finishes the comeback'});await h.command('dispatch.approve',{proposalId:move.id,version:move.version})
 r=await report();const ra=row(r,a.id),timer=ra.intervals.find(i=>i.id===billA.id)
 assert.deepEqual(timer.revisions.slice(-2).map(v=>v.reason),['Brake job ran two hours','Paper ticket shows brake job ended after one hour']);assert.equal(timer.countedMs,3600000)
 assert.deepEqual(ra.corrections.filter(c=>c.entryId===billA.id).map(c=>[c.status,c.approvedBy.role]),[['approved','owner'],['approved','owner']])
 assert.ok(ra.assignments.some(x=>x.jobId===two.id&&x.kind==='dispatch.approve'&&x.from===a.id&&x.to===b.id),'REPORT-003 drill-through shows the reassignment')
 assert.equal(ra.reworkMs,3600000,'REPORT-003 rework stays with the technician who clocked it');assert.deepEqual(ra.sold.map(l=>[l.jobId,l.milliHours]),[[one.id,1500]])
 assert.ok(!(await report(A)).technicians[0].assignments.some(x=>x.jobId===two.id),'REPORT-003 technicians see assignments only on their current repairs')
 // Pages follow the same roles.
 const page=async options=>{const response=await h.request('/app/reports/technicians'+q,options);assert.equal(response.status,200);return response.text()}
 const ownerHtml=await page({}),advHtml=await page(ADV),memberHtml=await page(A),bName=b.session.operator.displayName
 assert.match(ownerHtml,/\$225\.00/);assert.match(ownerHtml,/150\.0%/);assert.match(ownerHtml,/Save pay rate/)
 assert.doesNotMatch(advHtml,/\$30\.00|Pay cost|Save pay rate/);assert.match(advHtml,/150\.0%/)
 assert.doesNotMatch(memberHtml,new RegExp(bName));assert.doesNotMatch(memberHtml,/Pay cost/)
 // REPORT-006: export the same filtered native report, preserving numeric units and role boundaries.
 const csvPath='/api/mallet/reports/technicians'+q+'&format=csv',beforeExport=await h.state()
 const exported=await downloadReport(h,csvPath),adminExport=await downloadReport(h,csvPath,ADV),myExport=await downloadReport(h,csvPath,A)
 const metric=(records,id,key)=>records.find(x=>x.Record==='summary'&&x.TechnicianId===id&&x.Metric===key)
 assert.equal(metric(exported,a.id,'billableMs').Value,'3600000');assert.equal(metric(exported,a.id,'efficiencyTenths').Value,'1500');assert.equal(metric(exported,a.id,'payCents').Value,'22500');assert.equal(metric(exported,a.id,'payCents').Unit,'USD cents')
 assert.equal(exported.find(x=>x.Record==='timer'&&x.SourceId===billA.id).Value,'3600000')
 const soldCsv=exported.find(x=>x.Record==='sold-labor'&&x.JobId===one.id)
 assert.equal(soldCsv.Value,'1500');assert.equal(soldCsv.Description,"'=HYPERLINK(\"example\"),\nreplace and tune");assert.equal((await h.request(soldCsv.JobURL)).status,200)
 assert.ok(!adminExport.some(x=>['payCents','unratedMs'].includes(x.Metric)));assert.ok(!myExport.some(x=>['payCents','unratedMs'].includes(x.Metric)))
 assert.deepEqual([...new Set(myExport.map(x=>x.TechnicianId).filter(Boolean))],[a.id]);assert.ok(!myExport.some(x=>x.JobId===two.id&&x.Record==='assignment'))
 const emptyCsv=await downloadReport(h,'/api/mallet/reports/technicians?from=2000-01-01&to=2000-01-01&format=csv',A)
 assert.equal(metric(emptyCsv,a.id,'efficiencyTenths').Value,'','No denominator exports blank, never zero percent')
 const workbook=await downloadWorkbook(h,'/api/mallet/reports/technicians'+q+'&format=xlsx')
 assert.ok(workbook.some(r=>r.Metric==='payCents'&&Number(r.Value)>0))
 const ownWorkbook=await downloadWorkbook(h,'/api/mallet/reports/technicians'+q+'&format=xlsx',{as:a.cookie})
 assert.ok(!ownWorkbook.some(r=>r.Metric==='payCents'));assert.ok(ownWorkbook.filter(r=>r.TechnicianId).every(r=>r.TechnicianId===a.id))
 for(const bad of ['&format=pdf','&location=elsewhere','&from=2000-01-01'])await h.api('/api/mallet/reports/technicians'+q+bad,undefined,{status:400})
 await h.api(csvPath,undefined,{...agent,status:403});await h.api(csvPath,undefined,{as:'',status:401})
 assert.deepEqual(await h.state(),beforeExport,'Repeated downloads create no product writes')
 const saved=await h.command('reportFilter.save',{report:'technicians',name:'My scoped hours',from:r.period.from,to:r.period.to},A)
 assert.equal(saved.ownerId,a.id)
 await h.command('reportFilter.archive',{filterId:saved.id,version:saved.version},{as:advisor.cookie,status:403})
 await h.command('reportFilter.save',{report:'unknown',name:'Wrong dataset',from:r.period.from,to:r.period.to},{status:400})
 assert.ok((await h.state(A)).records.reportFilter.some(f=>f.id===saved.id));assert.ok(!(await h.state()).records.reportFilter.some(f=>f.id===saved.id),'Even the owner sees only personally saved filters')
 const ownerFilter=await h.command('reportFilter.save',{report:'technicians',name:'Owner scheduled hours',from:r.period.from,to:r.period.to})
 const dueAt=new Date(Date.now()+60000).toISOString(),schedule={filterId:ownerFilter.id,version:ownerFilter.version,active:true,everyDays:7,nextAt:dueAt,consent:true,evidence:'Owner explicitly consents to recurring private reports at their own native email'}
 await h.command('reportFilter.schedule',schedule,{as:advisor.cookie,status:403})
 await h.command('reportFilter.schedule',{...schedule,consent:false},{status:409})
 await h.command('reportFilter.schedule',schedule)
 const beforeScheduled=h.messages.length;await h.cron(dueAt)
 const firstDelivery=(await h.state()).records.reportDelivery.find(d=>d.filterId===ownerFilter.id)
 assert.equal(firstDelivery.content,undefined,'Delivery custody retains a hash, not another private report copy');assert.match(firstDelivery.contentHash,/^[a-f0-9]{64}$/)
 assert.ok(['accepted','development'].includes(firstDelivery.status));assert.equal(firstDelivery.to,'owner@example.test','Caller cannot choose a different recipient')
 if(firstDelivery.status==='accepted'){assert.equal(h.messages.length,beforeScheduled+1);assert.equal(h.messages.at(-1).attachments[0].filename,'mallet-technicians.csv')}
 await h.cron(dueAt);assert.equal((await h.state()).records.reportDelivery.length,1,'A repeated schedule tick never sends an occurrence twice')
 await h.restart();await h.cron(dueAt);assert.equal((await h.state()).records.reportDelivery.length,1,'Restart does not replay a claimed handoff')
 // OPS-001: rates, timers and corrections restore exactly; the fresh owner's report recomputes the same rows.
 let rejectMail=false
 const backup=await archive(h),fresh=await installation({mailService:()=>rejectMail?Response.json({error:'synthetic-mallet-mail-failure'},{status:503}):Response.json({id:crypto.randomUUID()})})
 try{await restore(fresh,backup);assert.deepEqual((await fresh.state()).records.reportFilter,[],'Archived source identities grant no destination filter ownership');const db=await fresh.mf.getD1Database('DB');assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM mallet_records WHERE kind='reportFilter'").first()).n,2,'Saved filter history survives recovery');const beforeRestored=fresh.messages.length;await fresh.cron(new Date(Date.parse(dueAt)+8*86400000).toISOString());assert.equal(fresh.messages.length,beforeRestored,'Restored schedules have no delivery authority');const again=await fresh.api('/api/mallet/reports/technicians'+q);assert.deepEqual(again.technicians,r.technicians);assert.deepEqual((await downloadReport(fresh,csvPath)).filter(x=>x.Metric!=='generatedAt'),exported.filter(x=>x.Metric!=='generatedAt'),'REPORT-006 CSV values reproduce under fresh owner authority')
  const freshOwner=(await fresh.state()).actor,own=await fresh.command('reportFilter.save',{report:'technicians',name:'Fresh owner permission proof',from:r.period.from,to:r.period.to}),nextAt=new Date(Date.now()+60000).toISOString(),grant={filterId:own.id,version:own.version,active:true,everyDays:1,nextAt,consent:true,evidence:'Fresh owner explicitly consents to own recurring private report'}
  await fresh.command('reportFilter.schedule',grant);rejectMail=true;await fresh.cron(nextAt)
  assert.equal((await fresh.state()).records.reportDelivery[0].status,'uncertain');assert.equal((await db.prepare('SELECT count(*) AS n FROM mallet_report_schedules').first()).n,0,'An uncertain handoff disables future delivery authority')
  const failedAttempts=fresh.messages.length;await fresh.cron(new Date(Date.parse(nextAt)+86400000).toISOString());assert.equal(fresh.messages.length,failedAttempts,'No automatic retry after an uncertain handoff')
  rejectMail=false;const current=(await fresh.state()).records.reportFilter.find(f=>f.id===own.id);await fresh.command('reportFilter.schedule',{...grant,version:current.version})
  const confirmOwnerAdministration=async as=>{
   await fresh.api('/auth/step-up',{action:'owner:transfer',returnTo:'/app'},{as,status:202})
   const token=new URL(fresh.messages.at(-1).text.match(/https?:\/\/[^\s<>]+\/auth\/confirm\?token=[^\s<>]+/)[0]).searchParams.get('token')
   assert.equal((await fresh.request('/auth/confirm',{method:'POST',as,body:{token}})).status,303)
  }
  await confirmOwnerAdministration(fresh.owner)
  const successor=await fresh.person('synthetic-mallet-report-owner@example.test','owner');await fresh.stepUp(successor.cookie);await confirmOwnerAdministration(successor.cookie);await fresh.api('/auth/operator/status',{operatorId:freshOwner.id,status:'inactive'},{as:successor.cookie})
  const beforeRevoked=fresh.messages.length;await fresh.cron(nextAt);assert.equal(fresh.messages.length,beforeRevoked,'Revoked recipients cannot receive a scheduled report');await fresh.api('/api/mallet/reports/technicians'+q,undefined,{status:401})
 }finally{await fresh.close()}
 const currentFilter=(await h.state()).records.reportFilter.find(f=>f.id===ownerFilter.id);await h.command('reportFilter.schedule',{...schedule,version:currentFilter.version,active:false});await h.cron(new Date(Date.parse(dueAt)+8*86400000).toISOString());assert.equal((await h.state()).records.reportDelivery.length,1,'Explicit revocation prevents future delivery')
 return {a,b,advisor,q}
}
