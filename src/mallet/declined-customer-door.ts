import {runtimeBindings,type Bindings} from '../auth.server'
import {digest} from './auth'
import {execute,load,rows} from './model'
import {page} from './ui/shell'

async function screen(path:string,withdrawn:boolean,status=200){
 const response=await page('Declined-work email permission',`<section class="card">${withdrawn?'<p>Your permission is withdrawn. Pending and future declined-work emails to this recipient are stopped.</p>':`<p>You can stop declined-work follow-up emails. This does not cancel an appointment or change any repair decision.</p><form method="post" action="${path}"><button type="submit" name="action" value="withdraw">Stop declined-work emails</button></form>`}</section>`,undefined,status)
 response.headers.set('cache-control','private, no-store');response.headers.set('referrer-policy','same-origin');response.headers.set('x-robots-tag','noindex, nofollow')
 return response
}
async function unavailable(){
 const response=await page('Link not available','<section class="card"><p>This email permission link is not available. Contact your repair shop.</p></section>',undefined,404)
 response.headers.set('cache-control','private, no-store');response.headers.set('referrer-policy','no-referrer');return response
}
/** A private link can only withdraw permission; it reveals no customer or repair data. */
export async function declinedCustomerResponse(request:Request,original:Bindings):Promise<Response|null>{
 const url=new URL(request.url);if(!url.pathname.startsWith('/declined-email/'))return null
 const match=url.pathname.match(/^\/declined-email\/([A-Za-z0-9_-]{43})$/),env=runtimeBindings(original)
 if(!match||url.origin!==env.AUTH_ORIGIN||request.headers.has('host')&&request.headers.get('host')?.toLowerCase()!==url.host.toLowerCase())return unavailable()
 if(!['GET','HEAD','POST'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{allow:'GET, HEAD, POST'}})
 const hash=await digest(match[1]),found=await env.DB.prepare('SELECT consent_id,outreach_id FROM mallet_declined_withdrawal_tokens WHERE token_hash=?').bind(hash).first<{consent_id:string,outreach_id:string}>()
 if(!found)return unavailable()
 const s=await load(env.DB),consent=rows(s,'declinedConsent').find(r=>r.id===found.consent_id),asset=consent&&rows(s,'asset').find(r=>r.id===consent.assetId)
 if(!consent||!asset||asset.privacyErasedAt||consent.erasureSuppressedAt)return unavailable()
 if(request.method!=='POST')return screen(url.pathname,!!consent.withdrawnAt)
 if(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site')return new Response('Same-origin form required',{status:403})
 if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))return new Response('Form required',{status:415})
 // The form has a single fixed operation and never accepts an identity or record id.
 await request.body?.cancel()
 const authority={sql:'EXISTS(SELECT 1 FROM mallet_declined_withdrawal_tokens WHERE token_hash=? AND consent_id=? AND outreach_id=?)',params:[hash,consent.id,found.outreach_id]}
 try{
  await execute(env.DB,{id:'declined-link:'+consent.id,name:'Private email permission link holder',role:'customer'},'outreach.customerWithdraw',{consentId:consent.id,version:consent.version},authority)
  return screen(url.pathname,true)
 }catch(error:any){if(error.code==='VERSION'||error.code==='CONCURRENT_CHANGE')return new Response(null,{status:303,headers:{location:url.pathname,'cache-control':'no-store'}});return unavailable()}
}
