import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation,booking} from './harness.mjs'
import {enterpriseProviderEdge,scim} from './support/enterprise-provider.mjs'
const cookies=(h,cookie)=>cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin}))
export async function enterpriseBrowser(){
 const edge=enterpriseProviderEdge(),email='synthetic-mallet-browser@example.com',externalId='synthetic-mallet-browser';let browser,h,idp
 try{
  idp=await edge.listen(externalId,email);edge.providers[2].issuer=idp.origin
  h=await installation({network:true,secureNetwork:true,assets:true,bindings:{MALLET_ENTERPRISE_OIDC:JSON.stringify([edge.providers[2]]),OIDC_TRANSACTION_SECRET:'synthetic-mallet-independent-transaction-secret'},outboundService:edge.outbound})
  const dir=process.env.MALLET_ENTERPRISE_PROOF_DIR??'.cache/enterprise-browser';await mkdir(dir,{recursive:true})
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});const context=await browser.newContext({ignoreHTTPSErrors:true});await context.addCookies(cookies(h,h.owner));const page=await context.newPage()
  await page.goto(h.origin+'/setup');await page.getByLabel('Sales tax rate (%)',{exact:true}).fill('7.5');await page.getByLabel('I confirm this owner account is ready to use.').check();await page.getByRole('button',{name:'Finish setup'}).click();await page.waitForURL('**/app');await h.stepUp()
  const shot=async(name,p=page)=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width);const controls=await p.locator('button,a').evaluateAll(nodes=>nodes.filter(n=>!n.textContent.trim()&&!n.querySelector('img[alt]')).map(n=>({label:n.getAttribute('aria-label'),tooltip:n.getAttribute('data-tooltip')})));assert.ok(controls.every(c=>c.label&&c.tooltip),'Icon-only controls provide tooltips');await p.screenshot({path:join(dir,name+'-'+width+'.png'),fullPage:true,mask:[p.locator('[name="scimToken"]')]})}}
  await page.goto(h.origin+'/app/data');await shot('00-enterprise-entry');await page.getByRole('link',{name:'Enterprise sign-in',exact:true}).click();await shot('01-owner-mapping');await page.getByText('Provider setup reference',{exact:true}).click();await shot('01a-provider-setup');await page.getByText('Provider setup reference',{exact:true}).click()
  await page.getByLabel('Reason for this change').fill('Provision our service-bay technicians');await page.getByLabel('I authorize this provider to provision technicians in this shop only.').check();await page.getByRole('button',{name:'Enable provisioning'}).click();await page.getByLabel('New SCIM bearer token').waitFor();const token=await page.getByLabel('New SCIM bearer token').inputValue();await shot('02-one-time-credential')
  const provider=edge.providers[2],user=await scim(h,provider,token,'',{method:'POST',body:{userName:email,externalId,displayName:'Taylor Brooks',active:true},status:201}),{job}=await booking(h,{technicianId:user.id})
  await page.goto(h.origin+'/app/enterprise');assert.equal(await page.getByLabel('New SCIM bearer token').count(),0);await page.getByText('Taylor Brooks',{exact:true}).waitFor();await shot('03-technician-provisioned')
  const technician=await browser.newContext({ignoreHTTPSErrors:true}),tech=await technician.newPage();await tech.goto(h.origin+'/signin?returnTo='+encodeURIComponent('/app/jobs/'+job.id));await tech.getByRole('button',{name:/Okta/}).waitFor();await shot('05-configured-sign-in',tech)
  await tech.getByRole('button',{name:/Okta/}).click();await tech.getByRole('button',{name:'Continue to workshop',exact:true}).click();await tech.getByRole('link',{name:'Continue to workshop',exact:true}).waitFor();await shot('05a-oidc-confirmed',tech);await tech.getByRole('link',{name:'Continue to workshop',exact:true}).click();await tech.waitForURL('**/app/jobs/'+job.id);await shot('04-assigned-repair',tech)
  await page.getByText('Manage provisioning',{exact:true}).click();await shot('03a-manage-connection');await page.locator('form[action="/app/enterprise/revoke"] [name="reason"]').fill('Employee directory connection withdrawn');await page.getByLabel('I authorize revoking this provider’s provisioning authority.').check();await page.getByRole('button',{name:'Revoke provisioning',exact:true}).click();await page.getByText('Deactivated',{exact:false}).waitFor();await shot('06-revoked')
  await tech.reload();assert.ok(tech.url().includes('/signin'));await shot('07-old-session-refused',tech)
  assert.equal((await h.state()).records.job.find(j=>j.id===job.id).technicianId,user.id);await technician.close()
 }finally{await browser?.close();await h?.close();await idp?.close()}
}
