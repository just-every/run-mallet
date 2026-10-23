import {shopSetup} from './diagnosis-journey.mjs'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {booking,archive,restore,installation} from '../harness.mjs'
import {assetFixtures,assetInput} from './asset-journey.mjs'
export const deviceResult=(serial='synthetic-mallet-202')=>JSON.stringify({Serial:serial,IMEI:'490154203237518',AppVersion:'3.0.611',BuildNo:'2.0.2',Version:'16.4.1',Passed:'WiFi, Speaker',Failed:'Face ID',Pending:'Battery',Working:'No',Notes:'<script>throw new Error("source content ran")</script>'},null,2)+'\n'
export async function diagnosticResultsJourney(h){
 await shopSetup(h)
 const asset=await h.command('asset.create',assetInput(assetFixtures[1])),{job}=await booking(h,{asset}),raw=deviceResult(),input={jobId:job.id,version:job.version,raw}
 const member=await h.person('diagnostic-member@example.test'),admin=await h.person('diagnostic-admin@example.test','admin'),key=await h.command('agent.create',{label:'No provider result access'})
 const agent={as:'',headers:{authorization:'Bearer '+key.token}}
 for(const options of [{as:'',status:401},{as:member.cookie,status:403},{as:admin.cookie,status:403},{...agent,status:403},{headers:{origin:'https://other.test'},status:403}])await h.command('diagnosticResult.importPhonecheck',input,options)
 for(const invalid of ['not JSON','[]',JSON.stringify({Serial:asset.identifier,Passed:'',Failed:'',Pending:'',Version:'16.4.1'}),JSON.stringify({Serial:asset.identifier,AppVersion:'1',Passed:['WiFi'],Failed:'',Pending:''}),' '.repeat(65537)])await h.command('diagnosticResult.importPhonecheck',{...input,raw:invalid},{status:400})
 const source=await h.command('diagnosticResult.importPhonecheck',{...input,results:{Failed:''},customerExplanation:'Everything passed'})
 assert.equal(source.status,'matched');assert.equal(source.raw,raw);assert.equal(source.sha256,createHash('sha256').update(raw).digest('hex'));assert.equal(source.appVersion,'3.0.611');assert.equal(source.build,'2.0.2');assert.deepEqual(source.results,{Passed:'WiFi, Speaker',Failed:'Face ID',Pending:'Battery'});assert.equal(source.label.includes('did not verify'),true)
 assert.equal((await h.command('diagnosticResult.importPhonecheck',input)).id,source.id,'Duplicate bytes retain the original imported result')
 const mismatch=await h.command('diagnosticResult.importPhonecheck',{...input,raw:deviceResult('synthetic-mallet-999')});assert.equal(mismatch.status,'quarantined');assert.equal(mismatch.results.Failed,'Face ID');assert.equal((await h.state()).records.diagnosis?.length??0,0,'A wrong serial never becomes repair findings')
 const imeiMismatch=await h.command('diagnosticResult.importPhonecheck',{...input,raw:raw.replace('490154203237518','490154203237519')});assert.equal(imeiMismatch.status,'quarantined','Both declared serial and saved IMEI must agree')
 await h.command('diagnosis.record',{jobId:job.id,version:job.version,complaint:'Repair review',customerExplanation:'Prepared explanation does not change measured results',dtcs:[],measurements:[]})
 assert.deepEqual((await h.state()).records.diagnosticResult.find(r=>r.id===source.id),source,'Independent explanations never rewrite the imported test results')
 for(const options of [{as:admin.cookie},{as:member.cookie},agent]){
  assert.ok(!JSON.stringify(await h.state(options)).includes('source content ran'))
  const graph=await h.api('/api/mallet/repairs/'+job.id,undefined,{...options,...(options.as===member.cookie?{status:404}:{})});assert.ok(!JSON.stringify(graph).includes('source content ran'))
 }
 const link=await h.command('diagnosisLink.create',{jobId:job.id,days:1});const publicReport=await h.request(new URL(link.url).pathname,{as:''});assert.equal(publicReport.status,200);assert.ok(!(await publicReport.text()).includes('source content ran'))
 const backup=await archive(h),fresh=await installation({bindings:{OWNER_EMAIL:'diagnostic-recovery@example.test'}})
 try{await restore(fresh,backup);assert.deepEqual((await fresh.state()).records.diagnosticResult,(await h.state()).records.diagnosticResult);await fresh.state({as:h.owner,status:401});await shopSetup(fresh);const restoredPage=await fresh.request('/app/jobs/'+job.id);assert.ok((await restoredPage.text()).includes('Quarantined mismatch'))}finally{await fresh.close()}
}
