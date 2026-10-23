import {createHash} from 'node:crypto'
import {event,fail,object,put,rows,text,who,type Handler} from './model'
import {openJob} from './workshop'
import {assetType} from './asset-types'
export const diagnosticResultCommands=['diagnosticResult.importPhonecheck']
// Device Info response fields published by Phonecheck. These source strings are
// retained exactly; OS Version and Working are not diagnostic test versions/results.
export function phonecheckResult(raw:unknown){
 if(typeof raw!=='string'||new TextEncoder().encode(raw).length>64*1024)fail('INPUT','Use a Phonecheck Device Info JSON result of at most 64 KiB.',null,400)
 let parsed:any;try{parsed=JSON.parse(raw)}catch{fail('INPUT','The result must be valid Phonecheck Device Info JSON.',null,400)}
 const source=object(parsed,'Phonecheck device result'),serial=text(source.Serial,'source Serial',100,true),imei=text(source.IMEI,'source IMEI',100,true)
 if(!serial&&!imei)fail('INPUT','The provider result must contain Serial or IMEI.',null,400)
 const appVersion=text(source.AppVersion,'Phonecheck AppVersion',100),build=text(source.BuildNo,'Phonecheck BuildNo',100,true)
 const results=Object.fromEntries(['Passed','Failed','Pending'].map(key=>{
  if(typeof source[key]!=='string'||source[key].length>16000)fail('INPUT','Passed, Failed and Pending must be the provider’s original result strings.',null,400)
  return [key,source[key]]
 }))
 return {serial,imei,appVersion,build,results,raw,sha256:createHash('sha256').update(raw,'utf8').digest('hex')}
}
export const diagnosticResults:Handler=(c,command,p)=>{
 if(!diagnosticResultCommands.includes(command))return
 if(c.actor.role!=='owner')fail('FORBIDDEN','Only the owner imports private provider result files.',null,403)
 const job=openJob(c,p)
 if(assetType(job.asset)!=='device')fail('INPUT','Phonecheck device results belong to a device repair.',null,400)
 const source=phonecheckResult(p.raw),prior=rows(c.s,'diagnosticResult').find(r=>r.jobId===job.id&&r.sha256===source.sha256)
 if(prior)return prior
 const expected={identifier:job.asset.identifier,imei:job.asset.specifications?.imei??''}
 const matched=[source.serial,source.imei].filter(Boolean).some(id=>id.toLowerCase()===expected.identifier.toLowerCase())&&(!expected.imei||source.imei.toLowerCase()===expected.imei.toLowerCase())
 const row=put(c.s,'diagnosticResult',{jobId:job.id,assetId:job.assetId,adapter:'phonecheck-device-info',...source,expected,status:matched?'matched':'quarantined',by:who(c),at:c.now,label:matched?'Imported result; identifier matches this saved visit. Mallet did not verify the provider or perform these tests.':'Quarantined: source serial/IMEI does not match this saved visit. Not applied to repair findings.'})
 event(c,command,job.id,row.id,{adapter:row.adapter,status:row.status,sha256:row.sha256});return row
}
