import assert from 'node:assert/strict'
import {inflateRawSync} from 'node:zlib'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {DOMParser} from '@xmldom/xmldom'
import {installation,booking} from './harness.mjs'
import {scim} from './support/enterprise-provider.mjs'
import {samlProviderEdge,samlEndpoints} from './support/saml-provider.mjs'

const cookies=(h,cookie)=>cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin}))
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))

export async function samlBrowser(){
 const edge=samlProviderEdge(),provider=edge.providers[0],h=await installation({network:true,secureNetwork:true,assets:true,bindings:{MALLET_ENTERPRISE_SAML:JSON.stringify([provider])}});let browser
 try{
  const dir=process.env.MALLET_ENTERPRISE_PROOF_DIR??'.cache/enterprise-browser';await mkdir(dir,{recursive:true})
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  const context=await browser.newContext({ignoreHTTPSErrors:true});await context.addCookies(cookies(h,h.owner));const page=await context.newPage()
  await page.goto(h.origin+'/setup');await page.getByLabel('Sales tax rate (%)',{exact:true}).fill('7.5');await page.getByLabel('I confirm this owner account is ready to use.').check();await page.getByRole('button',{name:'Finish setup'}).click();await page.waitForURL('**/app');await h.stepUp()
  const shot=async(name,p=page)=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width);const controls=await p.locator('button,a').evaluateAll(nodes=>nodes.filter(n=>!n.textContent.trim()&&!n.querySelector('img[alt]')).map(n=>({label:n.getAttribute('aria-label'),tooltip:n.getAttribute('data-tooltip')})));assert.ok(controls.every(c=>c.label&&c.tooltip),'Icon-only controls provide tooltips');await p.screenshot({path:join(dir,name+'-'+width+'.png'),fullPage:true,mask:[p.locator('[name="scimToken"]')]})}}
  await page.goto(h.origin+'/app/enterprise');await page.getByText('Provider setup reference',{exact:true}).click();await shot('08-saml-owner-setup');await page.getByText('Provider setup reference',{exact:true}).click()
  await page.getByLabel('Reason for this change').fill('Approve our workshop SAML directory');await page.getByLabel('I authorize this provider to provision technicians in this shop only.').check();await page.getByRole('button',{name:'Enable provisioning'}).click();const token=await page.getByLabel('New SCIM bearer token').inputValue()
  const subject='synthetic-mallet-browser-saml',user=await scim(h,provider,token,'',{method:'POST',status:201,body:{userName:'synthetic-mallet-saml-browser@example.test',externalId:subject,displayName:'Morgan Reed',active:true}}),{job}=await booking(h,{technicianId:user.id})
  const technician=await browser.newContext({ignoreHTTPSErrors:true}),tech=await technician.newPage()
  // Only the external IdP is controlled. The browser submits the real signed POST
  // response across origins, including the request cookie and native admission.
  await tech.route(provider.ssoUrl+'?**',async route=>{
   const url=new URL(route.request().url()),xml=inflateRawSync(Buffer.from(url.searchParams.get('SAMLRequest'),'base64')).toString('utf8'),request=new DOMParser().parseFromString(xml,'text/xml').documentElement
   const response=edge.issue(h,provider,{id:request.getAttribute('ID')},subject)
   await route.fulfill({contentType:'text/html',body:'<!doctype html><html><body><form method="post" action="'+escape(samlEndpoints(h,provider).acs)+'"><input name="SAMLResponse" type="hidden" value="'+Buffer.from(response).toString('base64')+'"><button>Continue to workshop</button></form></body></html>'})
  })
  await tech.goto(h.origin+'/signin?returnTo='+encodeURIComponent('/app/jobs/'+job.id));await tech.getByRole('button',{name:/Okta SAML/}).waitFor();await shot('09-saml-sign-in',tech)
  await tech.getByRole('button',{name:/Okta SAML/}).click();await tech.getByRole('button',{name:'Continue to workshop'}).click();await tech.waitForURL('**/app/jobs/'+job.id);await shot('10-saml-assigned-repair',tech)
  await scim(h,provider,token,'/'+user.id,{method:'PATCH',body:{Operations:[{op:'replace',path:'active',value:false}]}})
  await tech.reload();assert.ok(tech.url().includes('/signin'));await shot('11-saml-old-session-refused',tech)
  await technician.close()
 }finally{await browser?.close();await h.close()}
}
