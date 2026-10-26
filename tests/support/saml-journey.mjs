import assert from 'node:assert/strict'
import {DOMParser} from '@xmldom/xmldom'
import {installation,booking,assetInput,archive,restore} from '../harness.mjs'
import {enableConnection,scim} from './enterprise-provider.mjs'
import {samlProviderEdge,samlEndpoints,responseCookies} from './saml-provider.mjs'

const METADATA='urn:oasis:names:tc:SAML:2.0:metadata'
async function refused(h,response,label){
 assert.ok(response.status>=400&&response.status<500,label+': assertion is refused')
 const cookie=responseCookies(response)
 await h.api('/auth/session',undefined,{as:cookie,status:401})
 await h.api('/api/mallet/state',undefined,{as:cookie,status:401})
}
async function metadata(h,p){
 const response=await h.request('/auth/saml/'+p.id+'/metadata',{as:''})
 assert.equal(response.status,200)
 const document=new DOMParser().parseFromString(await response.text(),'text/xml'),root=document.documentElement
 assert.equal(root.namespaceURI,METADATA);assert.equal(root.localName,'EntityDescriptor')
 assert.equal(root.getAttribute('entityID'),samlEndpoints(h,p).audience)
 const acs=Array.from(root.getElementsByTagNameNS(METADATA,'AssertionConsumerService'))
 assert.ok(acs.some(node=>node.getAttribute('Location')===samlEndpoints(h,p).acs&&node.getAttribute('Binding')==='urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST'),'Public metadata advertises the working POST ACS')
}
async function rejectAssertions(h,edge,p,subject,email){
 const future=new Date(Date.now()+3600000).toISOString(),past=new Date(Date.now()-3600000).toISOString()
 const cases=[
  ['untrusted response issuer',{issuer:'http://www.okta.com/synthetic-mallet-untrusted'}],
  ['untrusted assertion issuer',{assertionIssuer:'http://www.okta.com/synthetic-mallet-untrusted'}],
  ['wrong audience',{audience:samlEndpoints(h,p).audience+'/other-shop'}],
  ['wrong destination',{destination:h.origin+'/auth/saml/enterprise-other-saml/acs'}],
  ['wrong recipient',{recipient:h.origin+'/auth/saml/enterprise-other-saml/acs'}],
  ['unknown request',{requestId:'_'+ 'a'.repeat(64)}],
  ['subject request mismatch',{subjectRequestId:'_'+ 'b'.repeat(64)}],
  ['future conditions',{notBefore:future}],
  ['expired conditions',{expires:past}],
  ['expired subject confirmation',{subjectExpires:past}],
  ['stale response',{issueInstant:past}],
  ['future assertion',{assertionIssueInstant:future}],
  ['future authentication',{authnInstant:future}],
  ['unsigned assertion',{signAssertion:false}],
  ['unsigned response',{signResponse:false}],
  ['unsolicited response',{unsolicited:true}],
  ['unprovisioned exact NameID despite matching email',{nameId:subject+'-unmapped',email}],
 ]
 for(const [label,options] of cases){
  const transaction=await edge.start(h,p),document=edge.issue(h,p,transaction,subject,options)
  await refused(h,await edge.post(h,p,transaction,document),label)
 }
 const unbound=await edge.start(h,p)
 await refused(h,await edge.post(h,p,unbound,edge.issue(h,p,unbound,subject),{cookie:''}),'missing browser request binding')
 for(const [label,tamper] of [
  ['changed signed NameID',document=>document.replace('>'+subject+'</saml:NameID>','>'+subject+'-changed</saml:NameID>')],
  ['changed response signature',document=>document.replace(/(<ds:SignatureValue>)([A-Za-z0-9+/])/,(_,tag,first)=>tag+(first==='A'?'B':'A'))],
 ]){
  const transaction=await edge.start(h,p),signed=edge.issue(h,p,transaction,subject),changed=tamper(signed)
  assert.notEqual(changed,signed,'Fixture actually changes '+label)
  await refused(h,await edge.post(h,p,transaction,changed),label)
 }
}

// One related admission journey: signed IdP responses confer only SCIM authority,
// then obey native session, local factor, deactivation and archive boundaries.
export async function samlJourney(){
 const edge=samlProviderEdge(),bindings={MALLET_ENTERPRISE_SAML:JSON.stringify(edge.providers)},h=await installation({bindings})
 try{
  const [p,other]=edge.providers
  await metadata(h,p)
  await h.stepUp()
  const {token}=await enableConnection(h,p),otherToken=(await enableConnection(h,other)).token
  const subject='synthetic-mallet-saml-subject',email='synthetic-mallet-saml@example.test'
  const user=await scim(h,p,token,'',{method:'POST',status:201,body:{userName:email,externalId:subject,displayName:'Synthetic SAML technician',active:true}})
  await scim(h,other,otherToken,'',{method:'POST',status:201,body:{userName:'synthetic-mallet-other-saml@example.test',externalId:subject,displayName:'Other SAML technician',active:true}})
  assert.equal(user.roles[0].value,'technician')
  const {job}=await booking(h,{asset:await h.command('asset.create',assetInput('synthetic-mallet-saml')),technicianId:user.id})
  const first=await edge.signIn(h,p,subject,{form:true,returnTo:'/app/jobs/'+job.id})
  assert.equal(first.response.headers.get('location'),'/app/jobs/'+job.id)
  assert.equal((await h.api('/auth/session',undefined,{as:first.cookie})).operator.id,user.id)
  assert.ok((await h.state({as:first.cookie})).records.job.some(row=>row.id===job.id))
  assert.equal((await h.request('/app/jobs/'+job.id,{as:first.cookie})).status,200)
  const note=await h.command('note.add',{jobId:job.id,body:'Synthetic SAML technician inspected the brake'},{as:first.cookie})
  assert.equal(note.by.id,user.id,'Native repair action records the provisioned actor')

  await refused(h,await edge.post(h,p,first.transaction,first.document),'replayed signed response')
  await rejectAssertions(h,edge,p,subject,email)
  const one=await edge.start(h,p),two=await edge.start(h,other)
  await refused(h,await edge.post(h,other,{...one,cookie:two.cookie},edge.issue(h,other,one,subject)),'wrong-provider request mix-up')

  await h.api('/api/mallet/security/policy',{requireAll:true})
  await h.api('/api/mallet/state',undefined,{as:first.cookie,status:403})
  const factor=await h.stepUp(first.cookie)
  await h.state({as:first.cookie})
  const next=await edge.signIn(h,p,subject)
  await h.api('/api/mallet/state',undefined,{as:next.cookie,status:403})
  await h.api('/api/mallet/security/verify/recovery',{code:factor.recoveryCodes[0]},{as:next.cookie})
  assert.equal((await h.api('/auth/session',undefined,{as:next.cookie})).operator.id,user.id)
  assert.equal((await h.request('/app/jobs/'+job.id,{as:next.cookie})).status,200)

  await scim(h,p,token,'/'+user.id,{method:'PATCH',body:{Operations:[{op:'replace',path:'active',value:false}]}})
  for(const cookie of [first.cookie,next.cookie]){
   await h.api('/auth/session',undefined,{as:cookie,status:401})
   await h.api('/api/mallet/state',undefined,{as:cookie,status:401})
   assert.ok([303,401].includes((await h.request('/app/jobs/'+job.id,{as:cookie})).status))
  }
  const inactive=await edge.start(h,p)
  await refused(h,await edge.post(h,p,inactive,edge.issue(h,p,inactive,subject)),'SCIM-deactivated subject')
  const retained=(await h.state()).records
  assert.equal(retained.job.find(row=>row.id===job.id).technicianId,user.id)
  assert.deepEqual(retained.jobNote.find(row=>row.id===note.id).by,note.by)

  const backup=await archive(h),serialized=JSON.stringify(backup)
  for(const authority of [token,otherToken,email,subject])assert.ok(!serialized.includes(authority),'Archive omits directory authority')
  const fresh=await installation({bindings:{...bindings,OWNER_EMAIL:'synthetic-mallet-saml-recovery@example.test'}})
  try{
   await restore(fresh,backup)
   const recovered=(await fresh.state()).records,enterprise=await fresh.api('/api/mallet/enterprise')
   assert.deepEqual(recovered.job.find(row=>row.id===job.id),retained.job.find(row=>row.id===job.id))
   assert.deepEqual(recovered.jobNote.find(row=>row.id===note.id).by,note.by)
   assert.equal(enterprise.users.length,0)
   await scim(fresh,p,token,'',{status:401})
   await fresh.api('/auth/session',undefined,{as:next.cookie,status:401})
   await metadata(fresh,p)
   const start=await fresh.request('/auth/saml/'+p.id+'/start',{method:'POST',as:'',body:{returnTo:'/app/jobs'}})
   assert.ok(start.status>=400&&start.status<500,'Restoring repairs does not restore enterprise sign-in authority')
  }finally{await fresh.close()}
 }finally{await h.close()}
}
