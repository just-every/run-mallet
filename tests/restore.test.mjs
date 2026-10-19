import {test} from 'node:test'
import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'
import {mkdir} from 'node:fs/promises'
import {installation,assetInput,archive} from './harness.mjs'

test('DATA-001: fresh restore asks for the latest journal before acceptance and labels missing evidence honestly',async()=>{
 const source=await installation();let fresh,browser
 try{
  const asset=await source.command('asset.create',assetInput('restore-screen')),old=await archive(source)
  await source.command('asset.erase',{assetId:asset.id,confirm:'ERASE'})
  const later=await archive(source)
  fresh=await installation({network:true,assets:true,bindings:{AUTH_LOCAL:'true',OWNER_EMAIL:'restored-owner@example.test'}})
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'en-US',timezoneId:'America/New_York'})
  await context.addCookies(fresh.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:fresh.origin})))
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
  await mkdir('.cache/restore-browser',{recursive:true})
  const shot=async name=>{for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.evaluate(()=>{scrollTo(0,0);return new Promise(requestAnimationFrame)});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'.cache/restore-browser/'+name+'-'+width+'.png',fullPage:true})}await page.setViewportSize({width:1440,height:1000})}
  await page.goto(fresh.origin+'/setup');await shot('01-setup-restore-door')
  await page.getByRole('link',{name:'Restore a workshop backup before finishing setup'}).click();await shot('02-journal-prompt')
  const file=records=>({name:'workshop.rer',mimeType:'application/x-ndjson',buffer:Buffer.from(records.map(r=>JSON.stringify(r)).join('\n')+'\n')})
  await page.getByLabel('Workshop archive',{exact:true}).setInputFiles(file(old))
  await page.getByRole('button',{name:'Verify and restore workshop'}).click()
  await page.getByRole('status').filter({hasText:'Supply your latest archive as the journal, or explicitly accept'}).waitFor()
  assert.equal((await fresh.state()).records.asset,undefined,'DATA-001: no import occurs before the journal question is answered')
  await shot('03-missing-evidence')
  await page.getByLabel('Latest archive as erasure journal').setInputFiles(file(later))
  await page.getByRole('button',{name:'Verify and restore workshop'}).click()
  await page.getByRole('status').filter({hasText:'Restore refused: erasure_epoch'}).waitFor()
  assert.equal((await fresh.state()).records.asset,undefined,'DATA-001: known later journal refuses the old archive')
  await shot('04-known-erasure-refused')
  await page.getByLabel('Latest archive as erasure journal').setInputFiles([])
  await page.getByLabel('I have no later evidence; restore with erasure history unverified.').check()
  await page.getByRole('button',{name:'Verify and restore workshop'}).click()
  await page.getByRole('status').filter({hasText:'Restored. Erasure history unverified: supply your latest archive as the journal.'}).waitFor()
  assert.ok((await fresh.state()).records.asset.some(a=>a.id===asset.id))
  assert.notEqual((await fresh.state()).actor.id,(await source.state()).actor.id)
  await shot('05-unverified-restored')
  await page.getByRole('link',{name:'Review the restored shop and finish setup'}).click()
  await page.getByLabel('Sales tax rate (%)').fill('7.5');await page.getByRole('checkbox',{name:'I confirm this owner account is ready to use.'}).check();await page.getByRole('button',{name:'Finish setup',exact:true}).click()
  await page.goto(fresh.origin+'/app/data');await shot('06-data-restore-guidance')
  assert.equal(await page.getByRole('link',{name:'Open the restore screen'}).count(),1)
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await fresh?.close();await source.close()}
})
