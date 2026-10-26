import assert from 'node:assert/strict'
import {generateKeyPairSync,sign,createHash,randomBytes} from 'node:crypto'
export function enterpriseProviderEdge(){
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048}),jwk={...publicKey.export({format:'jwk'}),kid:'synthetic-mallet-1',alg:'RS256',use:'sig'},pending=new Map()
 const providers=[{id:'enterprise-google',preset:'google',issuer:'https://accounts.google.com',clientId:'synthetic-mallet-google',clientSecret:'synthetic-mallet-1',tokenAuthMethod:'client_secret_basic'},{id:'enterprise-entra',preset:'microsoft',tenant:'synthetic-mallet-tenant',issuer:'https://login.microsoftonline.com/synthetic-mallet-tenant/v2.0',clientId:'synthetic-mallet-entra',clientSecret:'synthetic-mallet-2',tokenAuthMethod:'client_secret_basic'},{id:'enterprise-okta',preset:'okta',issuer:'https://synthetic-mallet-1.okta.example',clientId:'synthetic-mallet-okta',clientSecret:'synthetic-mallet-3',tokenAuthMethod:'client_secret_basic'}]
 const b64=value=>Buffer.from(typeof value==='string'?value:JSON.stringify(value)).toString('base64url')
 const outbound=async request=>{
  const url=new URL(request.url),p=providers.find(p=>url.origin===new URL(p.issuer).origin);assert.ok(p,'Only configured provider edge requested')
  if(url.pathname.endsWith('/.well-known/openid-configuration'))return Response.json({issuer:p.issuer,authorization_endpoint:p.issuer+'/authorize',token_endpoint:p.issuer+'/token',jwks_uri:p.issuer+'/keys',response_types_supported:['code'],id_token_signing_alg_values_supported:['RS256'],token_endpoint_auth_methods_supported:['client_secret_basic'],code_challenge_methods_supported:['S256']})
  if(url.pathname.endsWith('/keys'))return Response.json({keys:[jwk]})
  if(url.pathname.endsWith('/token')){
   const form=new URLSearchParams(await request.text()),item=pending.get(form.get('code'));assert.ok(item,'One issued code reaches the token endpoint');pending.delete(form.get('code'));assert.equal(createHash('sha256').update(form.get('code_verifier')).digest('base64url'),item.challenge);assert.equal(form.get('redirect_uri'),item.redirect)
   const header=b64({alg:'RS256',kid:jwk.kid}),now=Math.floor(Date.now()/1000),payload=b64({iss:p.issuer,sub:item.subject,aud:p.clientId,iat:now,exp:now+300,nonce:item.nonce,email:item.email,email_verified:true,hd:item.email.split('@')[1]})
   return Response.json({token_type:'Bearer',id_token:header+'.'+payload+'.'+sign('RSA-SHA256',Buffer.from(header+'.'+payload),privateKey).toString('base64url')})
  }
  throw Error('Unexpected provider request')
 }
 async function signIn(h,p,subject,email,{status=303}={}){
  const started=await h.request('/auth/oidc/'+p.id+'/start',{method:'POST',as:'',body:{returnTo:'/app/jobs'}});assert.equal(started.status,303,await started.clone().text())
  const url=new URL(started.headers.get('location')),code=randomBytes(24).toString('base64url'),state=url.searchParams.get('state'),cookie=started.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')
  pending.set(code,{subject,email,nonce:url.searchParams.get('nonce'),challenge:url.searchParams.get('code_challenge'),redirect:url.searchParams.get('redirect_uri')})
  const response=await h.request('/auth/oidc/'+p.id+'/callback?'+new URLSearchParams({code,state}),{as:cookie});assert.equal(response.status,status,await response.clone().text());return {response,cookie:response.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')}
 }
 return {providers,outbound,signIn}
}
export const enableConnection=(h,p,overrides={})=>h.api('/api/mallet/enterprise/enable',{provider:p.id,role:'technician',location:'shop',reason:'Explicit fixture directory authority',consent:'yes',...overrides})
export async function scim(h,p,token,path='',{method='GET',body,status=200}={}){
 const r=await h.request('/scim/v2/'+p.id+'/Users'+path,{as:'',method,body,headers:{authorization:'Bearer '+token,'content-type':'application/scim+json'}});const value=status===204?null:await r.json();assert.equal(r.status,status,JSON.stringify(value));return value
}
