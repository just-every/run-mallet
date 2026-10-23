import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation} from '../harness.mjs'
export async function partsBrowser(name,fixture,journey){
 const h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}});let browser
 try{
 const f=await fixture(h);browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});const context=await browser.newContext()
 await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
 const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));const directory=process.env.MALLET_PARTS_PROOF_DIR?join(process.env.MALLET_PARTS_PROOF_DIR,name):'.cache/'+name+'-browser';await mkdir(directory,{recursive:true})
 const go=async path=>{await p.goto(h.origin+path);if(new URL(p.url()).pathname==='/setup'){await p.getByLabel('Sales tax rate (%)',{exact:true}).fill('0');await p.getByLabel('I confirm this owner account is ready to use.').check();await p.getByRole('button',{name:'Finish setup',exact:true}).click();await p.goto(h.origin+path)}}
 const shot=async name=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' overflow at '+width);for(const button of await p.locator('main button,main a').all())assert.ok((await button.innerText()).trim(),'Controls have visible labels');await p.screenshot({path:join(directory,name+'-'+width+'.png'),fullPage:true})}}
 const form=(command)=>p.locator('form').filter({has:p.locator('input[name="command"][value="'+command+'"]')})
 const submit=async(command,values,scope)=>{const target=scope??form(command);for(const [key,value]of Object.entries(values)){const el=target.locator('[name="'+key+'"]');if(await el.evaluate(e=>e.tagName)==='SELECT')await el.selectOption(String(value));else await el.fill(String(value))}await target.getByRole('button').click();await p.waitForLoadState('domcontentloaded')}
 await journey({h,f,p,go,shot,form,submit});assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
