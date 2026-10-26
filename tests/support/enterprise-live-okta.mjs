// Opt-in held-org journey. It creates only this run's disposable app and technician, then removes both.
import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {writeFile} from 'node:fs/promises'
import {installation,booking} from '../harness.mjs'
import {enableConnection,scim} from './enterprise-provider.mjs'
export async function liveOkta(){
 const origin=process.env.OKTA_ORG_URL?.replace(/\/$/,''),admin=process.env.OKTA_API_TOKEN
 assert.ok(origin&&admin,'Named Okta org and admin credential required')
 const endpoint=new URL(origin);assert.ok(endpoint.protocol==='https:'&&!endpoint.username&&!endpoint.password&&!endpoint.search&&!endpoint.hash)
 let appId,userId,h
 const receipt={provider:'Okta Integrator',at:new Date().toISOString(),signIn:false,scimNative:false,disabledSessions:false,attribution:false,cleanup:false}
 const api=async(path,{method='GET',body,allowed=[200]}={})=>{
  const r=await fetch(origin+path,{method,redirect:'manual',headers:{authorization:'SSWS '+admin,'content-type':'application/json',accept:'application/json'},...(body?{body:JSON.stringify(body)}:{})})
  if(!allowed.includes(r.status)){await r.body?.cancel();throw Error('Okta management request refused: HTTP '+r.status)}
  return r.status===204?null:r.json()
 }
 try{
  h=await installation({outboundService:request=>fetch(request)})
  const suffix=Date.now().toString(36),email='synthetic-mallet-i818-'+suffix+'@example.com',password='Mallet!aA1'+randomBytes(24).toString('base64url')
  const app=await api('/api/v1/apps?activate=true',{method:'POST',body:{name:'oidc_client',label:'RER Mallet i818 '+suffix,signOnMode:'OPENID_CONNECT',credentials:{oauthClient:{token_endpoint_auth_method:'client_secret_basic',pkce_required:true}},settings:{oauthClient:{application_type:'web',grant_types:['authorization_code'],response_types:['code'],redirect_uris:[h.origin+'/auth/oidc/enterprise-okta/callback'],consent_method:'TRUSTED'}}}});appId=app.id
  const user=await api('/api/v1/users?activate=false',{method:'POST',body:{profile:{firstName:'Taylor',lastName:'Mallet i818',email,login:email},credentials:{password:{value:password}}}});userId=user.id
  await api('/api/v1/users/'+userId+'/lifecycle/activate?sendEmail=false',{method:'POST'})
  await api('/api/v1/apps/'+appId+'/users',{method:'POST',body:{id:userId,scope:'USER'}})
  const provider={id:'enterprise-okta',preset:'okta',issuer:origin,clientId:app.credentials.oauthClient.client_id,clientSecret:app.credentials.oauthClient.client_secret,tokenAuthMethod:'client_secret_basic'}
  assert.ok(provider.clientId&&provider.clientSecret,'Created app returned private credentials')
  await h.configure({MALLET_ENTERPRISE_OIDC:JSON.stringify([provider]),OIDC_TRANSACTION_SECRET:randomBytes(32).toString('base64url')});await h.stepUp()
  const {token}=await enableConnection(h,provider),native=await scim(h,provider,token,'',{method:'POST',body:{userName:email,externalId:userId,displayName:'Taylor Mallet technician',active:true},status:201});receipt.scimNative=true
  const {job}=await booking(h,{technicianId:native.id})
  const authn=await fetch(origin+'/api/v1/authn',{method:'POST',redirect:'manual',headers:{'content-type':'application/json'},body:JSON.stringify({username:email,password})});assert.equal(authn.status,200,'Okta test-user authentication succeeded')
  const auth=await authn.json();if(auth.status!=='SUCCESS'||!auth.sessionToken)throw Error('Okta sign-in needs an org policy or enrollment interaction: '+String(auth.status))
  const start=await h.request('/auth/oidc/enterprise-okta/start',{method:'POST',as:'',body:{returnTo:'/app/jobs'}});assert.equal(start.status,303,'Mallet started real Okta authorization')
  const authorize=new URL(start.headers.get('location'));authorize.searchParams.set('sessionToken',auth.sessionToken);authorize.searchParams.set('prompt','none')
  const response=await fetch(authorize,{redirect:'manual'});if(![302,303].includes(response.status))throw Error('Okta hosted authorization requires browser interaction: HTTP '+response.status)
  const callback=new URL(response.headers.get('location'),origin);if(callback.origin!==h.origin||callback.searchParams.has('error'))throw Error('Okta authorization refused the isolated test app')
  const binding=start.headers.getSetCookie().map(x=>x.split(';')[0]).join('; '),signed=await h.request(callback.pathname+callback.search,{as:binding});assert.equal(signed.status,303,'Mallet verified the live Okta code and ID token')
  const cookie=signed.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');assert.equal((await h.api('/auth/session',undefined,{as:cookie})).operator.id,native.id);receipt.signIn=true
  await h.api('/api/mallet/state',undefined,{as:cookie});assert.equal((await h.request('/app/jobs/'+job.id,{as:cookie})).status,200)
  // The native SCIM door is exercised explicitly; this is not an Okta outbound-connector receipt.
  await api('/api/v1/users/'+userId+'/lifecycle/deactivate?sendEmail=false',{method:'POST',allowed:[200]})
  await scim(h,provider,token,'/'+native.id,{method:'PUT',body:{userName:email,externalId:userId,displayName:'Taylor Mallet technician',active:false}})
  await h.api('/api/mallet/state',undefined,{as:cookie,status:401});await h.api('/auth/session',undefined,{as:cookie,status:401});assert.ok([303,401].includes((await h.request('/app/jobs/'+job.id,{as:cookie})).status));receipt.disabledSessions=true
  assert.equal((await h.state()).records.job.find(j=>j.id===job.id).technicianId,native.id);receipt.attribution=true
 }finally{
  if(h)await h.close()
  if(userId){const user=await api('/api/v1/users/'+userId);if(user.status!=='DEPROVISIONED')await api('/api/v1/users/'+userId+'/lifecycle/deactivate?sendEmail=false',{method:'POST'});await api('/api/v1/users/'+userId+'?sendEmail=false',{method:'DELETE',allowed:[204]})}
  if(appId){await api('/api/v1/apps/'+appId+'/lifecycle/deactivate',{method:'POST',allowed:[200]});await api('/api/v1/apps/'+appId,{method:'DELETE',allowed:[204]})}
  receipt.cleanup=true
  if(process.env.MALLET_OKTA_RECEIPT)await writeFile(process.env.MALLET_OKTA_RECEIPT,JSON.stringify(receipt,null,2)+'\n',{mode:0o600})
  console.log(JSON.stringify(receipt))
 }
}
if(process.argv[1]===import.meta.filename)await liveOkta()
