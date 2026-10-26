import assert from 'node:assert/strict'
import {installation,booking,archive,restore} from '../harness.mjs'
import {enterpriseProviderEdge,enableConnection,scim} from './enterprise-provider.mjs'
export async function enterpriseJourney(){
 const edge=enterpriseProviderEdge(),h=await installation({bindings:{MALLET_ENTERPRISE_OIDC:JSON.stringify(edge.providers),OIDC_TRANSACTION_SECRET:'synthetic-mallet-independent-transaction-secret'},outboundService:edge.outbound})
 try{
  const admin=await h.person('synthetic-mallet-admin@example.test','admin')
  await h.api('/api/mallet/enterprise/enable',{provider:edge.providers[0].id,role:'technician',location:'shop',reason:'No owner proof',consent:'yes'},{as:admin.cookie,status:403})
  await h.api('/api/mallet/enterprise/enable',{provider:edge.providers[0].id,role:'technician',location:'shop',reason:'No factor',consent:'yes'},{status:403})
  await h.stepUp()
  for(const [i,p] of edge.providers.entries()){
   const {token}=await enableConnection(h,p),email=`synthetic-mallet-${i}@example.com`,externalId='synthetic-mallet-subject-'+i
   const user=await scim(h,p,token,'',{method:'POST',body:{userName:email,externalId,displayName:'Taylor Technician '+i,active:true},status:201})
   assert.equal(user.roles[0].value,'technician')
   await scim(h,p,token,'',{method:'POST',body:{userName:'owner@example.test',externalId:'synthetic-mallet-collision'},status:409})
   await scim(h,p,token,'',{method:'POST',body:{userName:'synthetic-mallet-denied@example.com',externalId:'synthetic-mallet-denied',roles:[{value:'owner'}]},status:403})
   const {job}=await booking(h,{technicianId:user.id,startAt:`2026-11-${10+i}T09:00:00Z`,endAt:`2026-11-${10+i}T10:00:00Z`,bayId:'Bay '+i})
   const {cookie}=await edge.signIn(h,p,externalId,email)
   assert.equal((await h.api('/auth/session',undefined,{as:cookie})).operator.id,user.id)
   assert.ok((await h.api('/api/mallet/state',undefined,{as:cookie})).records.job.some(j=>j.id===job.id))
   assert.equal((await h.request('/app/jobs/'+job.id,{as:cookie})).status,200)
   const wrong=await edge.signIn(h,p,'synthetic-mallet-unmapped',email,{status:403});assert.equal(wrong.cookie,'')
   const forged=await h.signInAs(email);await h.api('/auth/session',undefined,{as:forged,status:401});await h.api('/auth/operators',undefined,{as:forged,status:401});await h.api('/api/mallet/state',undefined,{as:forged,status:401})
   const mail=h.messages.length;await h.api('/auth/magic-link',{email},{as:'',status:202});assert.equal(h.messages.length,mail)
   const filtered=await scim(h,p,token,'?filter='+encodeURIComponent('userName eq '+JSON.stringify(email)));assert.equal(filtered.totalResults,1);assert.equal(filtered.Resources[0].id,user.id)
   await scim(h,p,token,'/'+user.id,{method:'PATCH',body:{Operations:[{op:'replace',path:'active',value:false}]}})
   await h.api('/api/mallet/state',undefined,{as:cookie,status:401});await h.api('/auth/session',undefined,{as:cookie,status:401});assert.ok([303,401].includes((await h.request('/app/jobs/'+job.id,{as:cookie})).status))
   assert.equal((await h.state()).records.job.find(j=>j.id===job.id).technicianId,user.id)
   await edge.signIn(h,p,externalId,email,{status:403})
   await scim(h,p,token,'/'+user.id,{method:'PATCH',body:{Operations:[{op:'replace',value:{active:true}}]}})
   await h.api('/api/mallet/state',undefined,{as:cookie,status:401})
   const again=await edge.signIn(h,p,externalId,email);assert.equal((await h.api('/auth/session',undefined,{as:again.cookie})).operator.id,user.id)
   const rotated=await h.api('/api/mallet/enterprise/rotate',{provider:p.id,reason:'Credential rotation',consent:'yes'})
   await scim(h,p,token,'',{status:401});await scim(h,p,rotated.token)
   await h.api('/api/mallet/enterprise/revoke',{provider:p.id,reason:'Connection withdrawn',consent:'yes'})
   await scim(h,p,rotated.token,'',{status:401});await h.api('/api/mallet/state',undefined,{as:again.cookie,status:401})
   const dump=JSON.stringify(await archive(h));assert.ok(!dump.includes(token));assert.ok(!dump.includes(rotated.token));assert.ok(!dump.includes('mallet_enterprise_users'))
  }
  const history=(await h.api('/api/mallet/audit?action=enterprise.user.updated')).entries;assert.equal(history.length,6)
  const backup=await archive(h),fresh=await installation();try{await restore(fresh,backup);assert.equal((await fresh.state()).records.job.length,3);assert.equal((await fresh.api('/api/mallet/enterprise')).users.length,0);assert.ok((await fresh.api('/api/mallet/audit?action=enterprise.user.provisioned')).entries.length===3)}finally{await fresh.close()}
 }finally{await h.close()}
}
