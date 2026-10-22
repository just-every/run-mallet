// GOV-004 / GOV-005: the owner sets up an authenticator app and a passkey, a new sign-in confirms before anything opens, and a refund-grade action asks again.
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation} from './harness.mjs'
import {totpCode} from './support/second-factor.mjs'
const cookies=(h,cookie)=>cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin}))
export async function securityBrowser(){
 // A real hostname: browsers refuse an IP address as a passkey's relying party.
 const h=await installation({network:true,assets:true,localhost:true,bindings:{AUTH_LOCAL:'true'}});let browser
 try{
  const setup=await fetch(h.origin+'/setup',{method:'POST',redirect:'manual',headers:{Origin:h.origin,Cookie:h.owner,'Content-Type':'application/x-www-form-urlencoded'},body:'confirm=yes&ratePercent=7.5&partsTaxable=yes'});assert.equal(setup.status,303);browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  const db=await h.mf.getD1Database('DB'),dir=process.env.MALLET_SECURITY_PROOF_DIR??'.cache/security-browser';await mkdir(dir,{recursive:true})
  const context=await browser.newContext();await context.addCookies(cookies(h,h.owner));const p=await context.newPage()
  const shot=async name=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width);await p.screenshot({path:join(dir,name+'-'+width+'.png'),fullPage:true})}}
  const cdp=await context.newCDPSession(p);await cdp.send('WebAuthn.enable');await cdp.send('WebAuthn.addVirtualAuthenticator',{options:{protocol:'ctap2',transport:'internal',hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}})
  // Authenticator app: the key is shown to the person, the code proves they hold it, recovery codes appear once.
  await p.goto(h.origin+'/app/data');await p.getByRole('link',{name:'Open security'}).click();await shot('security-01-none')
  await p.getByRole('button',{name:'Set up an authenticator app'}).click();const key=await p.locator('[data-totp-key]').innerText();await shot('security-02-authenticator-key')
  await p.getByLabel('Six-digit code').fill(totpCode(key));await p.getByRole('button',{name:'Confirm authenticator app'}).click()
  assert.match(await p.locator('main').innerText(),/Save your recovery codes/);assert.equal((await p.locator('pre').innerText()).trim().split('\n').length,8);await shot('security-03-recovery-codes')
  await p.getByRole('link',{name:'Continue'}).click()
  // Passkey: the browser's authenticator signs; the page needs no secret typed.
  await p.getByLabel('Passkey name').fill('Work laptop');await p.getByRole('button',{name:'Add a passkey'}).click();await p.getByText('Work laptop · Passkey').waitFor();await shot('security-04-two-factors')
  // A new sign-in owes the factor; nothing opens until it is confirmed (here with the passkey), then the person lands where they were going.
  await context.clearCookies();await context.addCookies(cookies(h,await h.signInAs((await h.api('/auth/session')).operator.email)))
  await p.goto(h.origin+'/app/jobs');assert.match(p.url(),/\/app\/security\?returnTo=%2Fapp%2Fjobs/);assert.match(await p.locator('main').innerText(),/Confirm your second factor/);await shot('security-05-confirm')
  await p.getByRole('button',{name:'Confirm with a passkey'}).click();await p.waitForURL('**/app/jobs')
  // A sensitive action asks again when the last confirmation is old, with the authenticator app this time.
  await db.prepare('UPDATE mallet_session_proofs SET step_up_until=0').run();await p.goto(h.origin+'/app/data');await p.getByLabel('Agent label').fill('Dispatch assistant');await p.getByRole('button',{name:'Create preparation key'}).click()
  assert.match(p.url(),/\/app\/security\?stepUp=1&returnTo=%2Fapp%2Fdata/);assert.match(await p.locator('main').innerText(),/Confirm again/);await shot('security-06-step-up')
  await db.prepare('UPDATE mallet_factors SET last_step=NULL').run();await p.getByLabel('Six-digit code').fill(totpCode(key));await p.getByRole('button',{name:'Confirm with authenticator app'}).click();await p.waitForURL('**/app/data')
  // Owner policy and the staff list.
  await p.goto(h.origin+'/app/security');await p.getByLabel('Second factor at sign-in').selectOption('yes');await p.getByRole('button',{name:'Save policy'}).click();assert.match(await p.locator('main').innerText(),/Shop policy saved/);await shot('security-07-policy')
 // GOV-005: declarations are public; the owner saves a sealed payment credential after reading them and never sees it again.
  await p.goto(h.origin+'/connectors');assert.match(await p.locator('main').innerText(),/What Mallet sends/);await shot('connectors-01-published')
  await p.goto(h.origin+'/app/connectors');await p.getByLabel('New credential').first().fill('synthetic-mallet-gov5-ui-key');await p.getByLabel(/I have read the Stripe declaration/).check();await p.getByRole('button',{name:'Save credential'}).first().click();await p.waitForLoadState('domcontentloaded')
assert.match(await p.locator('main').innerText(),/Saved version 1, fingerprint/);assert.ok(!(await p.content()).includes('synthetic-mallet-gov5-ui-key'));await shot('connectors-02-saved')
 }finally{await browser?.close();await h.close()}
}
