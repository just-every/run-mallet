// Opt-in held-org journey. It creates only this run's disposable app and technician, then removes both.
import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {chromium} from '@playwright/test'
import {installation,booking} from '../harness.mjs'
import {enableConnection,scim} from './enterprise-provider.mjs'
export async function liveOkta(){
 const origin=process.env.OKTA_ORG_URL?.replace(/\/$/,''),admin=process.env.OKTA_API_TOKEN
 assert.ok(origin&&admin,'Named Okta org and admin credential required')
 const endpoint=new URL(origin);assert.ok(endpoint.protocol==='https:'&&!endpoint.username&&!endpoint.password&&!endpoint.search&&!endpoint.hash)
 let appId,userId,h,browser
 const hidden=[origin,admin]
 const receipt={provider:'Okta Integrator',at:new Date().toISOString(),signIn:false,scimNative:false,disabledSessions:false,attribution:false,cleanup:false}
 const api=async(path,{method='GET',body,allowed=[200]}={})=>{
  const r=await fetch(origin+path,{method,redirect:'manual',headers:{authorization:'SSWS '+admin,'content-type':'application/json',accept:'application/json'},...(body?{body:JSON.stringify(body)}:{})})
  if(!allowed.includes(r.status)){const error=await r.json();let message=[error.errorCode,error.errorSummary,...(error.errorCauses??[]).map(x=>x.errorSummary)].filter(x=>typeof x==='string').join(' ');for(const value of hidden)if(value)message=message.replaceAll(value,'[redacted]');throw Error('Okta management request refused: HTTP '+r.status+' '+message)}
  if(r.status===204)return null
  const text=await r.text();return text?JSON.parse(text):null
 }
 try{
  h=await installation({network:true,secureNetwork:true,assets:true,outboundService:async request=>{const response=await fetch(request.url,{method:request.method,headers:Object.fromEntries(request.headers),redirect:'manual',...(['GET','HEAD'].includes(request.method)?{}:{body:await request.arrayBuffer()})});return new Response(await response.arrayBuffer(),{status:response.status,headers:response.headers})}})
  const suffix=Date.now().toString(36),email='synthetic-mallet-i818-'+suffix+'@example.com',password='A1!z'+randomBytes(24).toString('base64url');hidden.push(password,email)
  const app=await api('/api/v1/apps?activate=true',{method:'POST',body:{name:'oidc_client',label:'RER Mallet i818 '+suffix,signOnMode:'OPENID_CONNECT',credentials:{oauthClient:{token_endpoint_auth_method:'client_secret_basic',pkce_required:true}},settings:{oauthClient:{application_type:'web',grant_types:['authorization_code'],response_types:['code'],redirect_uris:[h.origin+'/auth/oidc/enterprise-okta/callback'],consent_method:'TRUSTED'}}}});appId=app.id;hidden.push(app.credentials.oauthClient.client_secret)
  const user=await api('/api/v1/users?activate=false',{method:'POST',body:{profile:{firstName:'Taylor',lastName:'Mallet i818',email,login:email},credentials:{password:{value:password}}}});userId=user.id
  await api('/api/v1/users/'+userId+'/lifecycle/activate?sendEmail=false',{method:'POST'})
  await api('/api/v1/apps/'+appId+'/users',{method:'POST',body:{id:userId,scope:'USER'}})
  const provider={id:'enterprise-okta',preset:'okta',issuer:origin,clientId:app.credentials.oauthClient.client_id,clientSecret:app.credentials.oauthClient.client_secret,tokenAuthMethod:'client_secret_basic'}
  assert.ok(provider.clientId&&provider.clientSecret,'Created app returned private credentials')
  await h.configure({MALLET_ENTERPRISE_OIDC:JSON.stringify([provider]),OIDC_TRANSACTION_SECRET:randomBytes(32).toString('base64url')});await h.stepUp()
  const {token}=await enableConnection(h,provider),native=await scim(h,provider,token,'',{method:'POST',body:{userName:email,externalId:userId,displayName:'Taylor Mallet technician',active:true},status:201});receipt.scimNative=true
  const {job}=await booking(h,{technicianId:native.id})
  const start=await h.request('/auth/oidc/enterprise-okta/start',{method:'POST',as:'',body:{returnTo:'/app/jobs'}});assert.equal(start.status,303,'Mallet started real Okta authorization: '+(start.status===303?'':await start.clone().text()))
  const authorize=new URL(start.headers.get('location'));hidden.push(...authorize.searchParams.values())
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});const context=await browser.newContext({ignoreHTTPSErrors:true}),page=await context.newPage()
  await context.addCookies(start.headers.getSetCookie().map(value=>{const pair=value.split(';')[0],split=pair.indexOf('=');return {name:pair.slice(0,split),value:pair.slice(split+1),url:h.origin}}))
  // Use the supported hosted sign-in path in a fresh profile, never an owner's browser.
  try{
   await page.goto(authorize.href)
   await page.locator('input[name="identifier"],input[name="username"],input[type="password"]').first().waitFor({state:'visible',timeout:15000})
   for(let step=0;step<4&&new URL(page.url()).origin!==h.origin;step++){
    const username=page.locator('input[name="identifier"],input[name="username"]').first(),pass=page.locator('input[type="password"]').first()
    if(await username.isVisible())await username.fill(email)
    if(await pass.isVisible())await pass.fill(password)
    const submit=page.locator('input[type="submit"],button[type="submit"]').first()
    if(!await submit.isVisible())break
    await submit.click();await page.waitForLoadState('networkidle')
   }
   if(new URL(page.url()).origin!==h.origin)throw Error('The isolated Okta user needs an additional hosted policy or enrollment interaction')
   const continued=page.getByRole('link',{name:'Continue to workshop',exact:true});if(await continued.isVisible())await continued.click()
  }catch(error){let message=String(error?.message??error);for(const value of hidden)if(value)message=message.replaceAll(value,'[redacted]');message=message.replace(/https?:\/\/[^\s]+/g,'[redacted URL]');throw Error('Okta hosted test-user sign-in: '+message.slice(0,300))}
  const cookie=(await context.cookies(h.origin)).map(value=>value.name+'='+value.value).join('; ');assert.equal((await h.api('/auth/session',undefined,{as:cookie})).operator.id,native.id);receipt.signIn=true
  await h.api('/api/mallet/state',undefined,{as:cookie});assert.equal((await h.request('/app/jobs/'+job.id,{as:cookie})).status,200)
  // The native SCIM door is exercised explicitly; this is not an Okta outbound-connector receipt.
  await api('/api/v1/users/'+userId+'/lifecycle/deactivate?sendEmail=false',{method:'POST',allowed:[200]})
  await scim(h,provider,token,'/'+native.id,{method:'PUT',body:{userName:email,externalId:userId,displayName:'Taylor Mallet technician',active:false}})
  await h.api('/api/mallet/state',undefined,{as:cookie,status:401});await h.api('/auth/session',undefined,{as:cookie,status:401});assert.ok([303,401].includes((await h.request('/app/jobs/'+job.id,{as:cookie})).status));receipt.disabledSessions=true
  assert.equal((await h.state()).records.job.find(j=>j.id===job.id).technicianId,native.id);receipt.attribution=true
 }finally{
  const closed=await Promise.allSettled([browser?.close(),h?.close()])
  const cleanup=await Promise.allSettled([
   (async()=>{if(!userId)return;const user=await api('/api/v1/users/'+userId);if(user.status!=='DEPROVISIONED')await api('/api/v1/users/'+userId+'/lifecycle/deactivate?sendEmail=false',{method:'POST'});await api('/api/v1/users/'+userId+'?sendEmail=false',{method:'DELETE',allowed:[204]})})(),
   (async()=>{if(!appId)return;await api('/api/v1/apps/'+appId+'/lifecycle/deactivate',{method:'POST',allowed:[200]});await api('/api/v1/apps/'+appId,{method:'DELETE',allowed:[204]})})(),
  ])
  receipt.cleanup=cleanup.every(r=>r.status==='fulfilled')&&closed.every(r=>r.status==='fulfilled')
  console.log(JSON.stringify(receipt))
  if(!receipt.cleanup)throw Error('Isolated Okta fixture cleanup did not complete')
 }
}
if(process.argv[1]===import.meta.filename)await liveOkta()
