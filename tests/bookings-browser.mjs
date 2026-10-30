import {createServer} from 'node:http'
import {once} from 'node:events'
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation} from './harness.mjs'
import {shopSetup} from './support/diagnosis-journey.mjs'
import {bookingEmail,bookingTime,bookingPost,holdFields,slotId} from './support/booking-journey.mjs'
export async function bookingsBrowser(){
 const h=await installation({network:true,secureNetwork:true,assets:true});let browser,embedServer
 try{
  await shopSetup(h);browser=await chromium.launch({headless:true,...(process.env.MALLET_CHROMIUM?{executablePath:process.env.MALLET_CHROMIUM}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
  const owner=await browser.newContext({ignoreHTTPSErrors:true}),customer=await browser.newContext({ignoreHTTPSErrors:true}),rival=await browser.newContext({ignoreHTTPSErrors:true});await owner.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const p=await owner.newPage(),c=await customer.newPage(),r=await rival.newPage(),dir=process.env.MALLET_BOOKING_PROOF_DIR??'.cache/bookings-browser';await mkdir(dir,{recursive:true})
  const shot=async(page,name)=>{for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width);await page.screenshot({path:join(dir,name+'-'+width+'.png'),fullPage:true})}}
  await p.goto(h.origin+'/app/jobs');await p.getByRole('link',{name:'Online appointments',exact:true}).click()
  const fields={name:'Brake inspection',location:'Main workshop',skill:'brakes',skills:'brakes, inspection',bayId:'Bay 1',startAt:new Date(Date.now()+86400000).toISOString().slice(0,10)+'T09:00:00Z',endAt:new Date(Date.now()+86400000).toISOString().slice(0,10)+'T12:00:00Z',durationMinutes:'60',leadMinutes:'60'}
  for(const [name,value]of Object.entries(fields))await p.locator(`[name="${name}"]`).fill(value)
  await shot(p,'booking-01-publish');await p.getByRole('button',{name:'Publish service'}).click();await p.waitForLoadState('domcontentloaded');await shot(p,'booking-02-staff-appointments')
  const service=(await h.state()).records.bookingService.find(x=>x.name==='Brake inspection')
  assert.ok(service);assert.equal(service.durationMinutes,60);assert.equal(service.windows.length,1)
  const decoy=await h.command('booking.publish',{...service,name:'Air conditioning diagnosis',durationMinutes:30,location:'Second workshop',windows:[{...service.windows[0],startAt:fields.startAt.replace('09:','14:'),endAt:fields.endAt.replace('12:','15:')}]})
  const unrelatedHold=await bookingPost(h,'/book',{...holdFields(decoy),name:'synthetic-mallet-40',email:bookingEmail(40)});assert.equal(unrelatedHold.status,303)
  assert.equal((await bookingPost(h,unrelatedHold.headers.get('location'),{action:'confirm',version:1})).status,200)
  const unrelated=(await h.state()).records.appointment.find(a=>a.serviceId===decoy.id)
  const occupied=[]
  for(const hour of [10,11]){
   const hold=await bookingPost(h,'/book',{...holdFields(service),email:bookingEmail(hour+50),slotId:slotId(service,{...service.windows[0],startAt:new Date(fields.startAt.replace('09:',hour+':')).toISOString()})},{'cf-connecting-ip':'192.0.2.50'})
   assert.equal(hold.status,303);occupied.push(hold.headers.get('location'))
  }
  embedServer=createServer((req,res)=>{res.writeHead(200,{'content-type':'text/html'});res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><iframe title="Shop booking" style="width:100%;height:900px;box-sizing:border-box" src="'+h.origin+'/book"></iframe>')});embedServer.listen(0,'127.0.0.1');await once(embedServer,'listening')
  const embedOrigin='http://127.0.0.1:'+embedServer.address().port
  const chooseService=async(page,width)=>{
   await page.setViewportSize({width,height:1000});await page.goto(embedOrigin)
   const embedded=page.frameLocator('iframe[title="Shop booking"]');await embedded.getByRole('heading',{name:'Choose a service'}).waitFor()
   // Select a different published service first so a default selection cannot pass.
   await embedded.getByRole('combobox',{name:/Service/}).selectOption({label:decoy.name});await embedded.getByRole('button',{name:'Show available times'}).click();await embedded.getByRole('heading',{name:decoy.name,exact:true}).waitFor()
   await embedded.getByRole('combobox',{name:/Service/}).selectOption({label:service.name});await embedded.getByRole('button',{name:'Show available times'}).click();await embedded.getByRole('heading',{name:service.name,exact:true}).waitFor()
   assert.equal(await embedded.getByRole('combobox',{name:/Service/}).inputValue(),service.id,'The embedded form retains the selected service at '+width)
   const form=embedded.locator('form:has(input[value="hold"])');assert.equal(await form.count(),1,'Only the final published bay slot is available')
   assert.equal(await form.locator('[name="serviceId"]').inputValue(),service.id)
   assert.equal(await form.locator('[name="slotId"]').inputValue(),slotId(service,{...service.windows[0],startAt:new Date(fields.startAt).toISOString()}))
   assert.match(await embedded.locator('main').innerText(),/Main workshop/);assert.doesNotMatch(await embedded.locator('main').innerText(),/Second workshop/)
   assert.ok(await embedded.locator('body').evaluate(el=>el.scrollWidth<=innerWidth),'The embedded form fits '+width)
   return form
  }
  await chooseService(c,1440);const first=await chooseService(c,390);await shot(c,'booking-02b-embedded-form');await shot(c,'booking-03-customer-times')
  const second=await chooseService(r,390),contenders=[{page:c,form:first,name:'synthetic-mallet-41',email:bookingEmail(41)},{page:r,form:second,name:'synthetic-mallet-42',email:bookingEmail(42)}]
  for(const contender of contenders){await contender.form.getByLabel('Your name').fill(contender.name);await contender.form.getByLabel('Confirmation email',{exact:true}).fill(contender.email);await contender.form.getByRole('checkbox').check()}
  const replies=contenders.map(({page})=>page.waitForResponse(response=>response.request().method()==='POST'&&new URL(response.url()).pathname==='/book'))
  await Promise.all(contenders.map(({form})=>form.getByRole('button',{name:'Hold this time'}).click()))
  const responses=await Promise.all(replies);assert.deepEqual(responses.map(response=>response.status()).sort(),[303,409],'Distinct customers contend through the embedded forms')
  const heldState=await h.state(),held=heldState.records.appointment.filter(a=>a.serviceId===service.id&&a.startAt===new Date(fields.startAt).toISOString());assert.equal(held.length,1)
  const winner=contenders.find(x=>x.email===held[0].email),loser=contenders.find(x=>x!==winner),w=winner.page
  await w.waitForURL(/\/book\/[A-Za-z0-9_-]{43}$/);await w.waitForLoadState('domcontentloaded');await shot(w,'booking-04-tentative')
  await loser.page.getByRole('alert').waitFor();assert.match(await loser.page.getByRole('alert').innerText(),/no longer available/)
  assert.equal(heldState.records.appointment.filter(a=>a.email===loser.email).length,0,'The losing customer has no reservation')
  assert.deepEqual(heldState.records.appointment.find(a=>a.id===unrelated.id),unrelated)
  assert.match(await w.locator('main').innerText(),/held/)
  // Release a separate tentative hold for the existing reschedule and email-limit checks.
  assert.equal((await bookingPost(h,occupied[0],{action:'cancel',version:1})).status,200)
  const refused=await customer.newPage();await refused.goto(h.origin+'/book?serviceId='+service.id);const limited=refused.locator('form:has(input[value="hold"])').first();await limited.getByLabel('Your name').fill(winner.name);await limited.getByLabel('Confirmation email',{exact:true}).fill(winner.email.toUpperCase());await limited.getByRole('checkbox').check();await limited.getByRole('button',{name:'Hold this time'}).click();await refused.getByRole('alert').waitFor();assert.match(await refused.getByRole('alert').innerText(),/email already has a tentative appointment/);await shot(refused,'booking-04b-hold-limit');await refused.close()
  // The real mail adapter is exercised against the harness's controlled network edge.
  const beforeMail=h.messages.filter(m=>m.subject==='Your confirmed appointment').length
  await w.getByRole('button',{name:'Confirm appointment',exact:true}).click();await w.waitForLoadState('domcontentloaded');await w.reload();await shot(w,'booking-05-confirmed')
  const confirmedState=await h.state(),confirmed=confirmedState.records.appointment.find(a=>a.id===held[0].id)
  assert.equal(confirmedState.records.appointment.filter(a=>a.serviceId===service.id&&a.status==='confirmed').length,1)
  assert.deepEqual({serviceId:confirmed.serviceId,name:confirmed.name,email:confirmed.email,bayId:confirmed.bayId,technicianId:confirmed.technicianId,startAt:confirmed.startAt,endAt:confirmed.endAt,status:confirmed.status},
   {serviceId:service.id,name:winner.name,email:winner.email,bayId:'Bay 1',technicianId:service.windows[0].technicianId,startAt:new Date(fields.startAt).toISOString(),endAt:new Date(fields.startAt.replace('09:','10:')).toISOString(),status:'confirmed'})
  assert.equal(confirmed.service.name,'Brake inspection');assert.equal(confirmed.service.location,'Main workshop');assert.equal(confirmed.delivery.status,'accepted')
  const shown=await w.locator('main').innerText();for(const value of [confirmed.id,'confirmed','Brake inspection','Main workshop','America/New_York',bookingTime(fields.startAt),bookingTime(fields.startAt.replace('09:','10:')),'Confirmation handed to the mail provider; delivery is not confirmed.'])assert.ok(shown.includes(value),'Customer readback: '+value)
  assert.doesNotMatch(shown,/Second workshop/)
  const messages=h.messages.filter(m=>m.subject==='Your confirmed appointment');assert.equal(messages.length,beforeMail+1)
  const mail=messages.at(-1);assert.deepEqual(mail.to,[winner.email]);for(const value of [confirmed.id,'Brake inspection','Main workshop','America/New_York',bookingTime(fields.startAt),bookingTime(fields.startAt.replace('09:','10:')),new URL(w.url()).pathname])assert.ok(mail.text.includes(value),'Matching confirmation: '+value)
  assert.equal(messages.filter(m=>m.to.includes(loser.email)).length,0)
  const managementPath=new URL(w.url()).pathname;assert.equal((await bookingPost(h,managementPath,{action:'confirm',version:held[0].version})).status,409)
  assert.equal(h.messages.filter(m=>m.subject==='Your confirmed appointment').length,beforeMail+1)
  await w.getByRole('button',{name:'Move appointment'}).first().click();await w.waitForLoadState('domcontentloaded');await shot(w,'booking-06-rescheduled')
  const moved=(await h.state()).records.appointment.find(a=>a.id===confirmed.id);assert.equal(moved.startAt,new Date(Date.parse(fields.startAt)+3600000).toISOString())
  const mailAfterMove=h.messages.filter(m=>m.subject==='Your confirmed appointment');assert.equal(mailAfterMove.length,beforeMail+2,'The requested move gets exactly one updated confirmation')
  assert.deepEqual(mailAfterMove.at(-1).to,[winner.email]);assert.ok(mailAfterMove.at(-1).text.includes(bookingTime(moved.startAt)))
  await w.getByRole('button',{name:'Cancel appointment',exact:true}).click();await w.waitForLoadState('domcontentloaded');await w.reload();await shot(w,'booking-07-canceled');assert.match(await w.locator('main').innerText(),/canceled/)
  const canceledState=await h.state(),canceled=canceledState.records.appointment.find(a=>a.id===confirmed.id);assert.equal(canceled.status,'canceled');assert.deepEqual(canceledState.records.appointment.find(a=>a.id===unrelated.id),unrelated)
  const newcomer=await rival.newPage();await newcomer.setViewportSize({width:390,height:1000});await newcomer.goto(h.origin+'/book?serviceId='+service.id)
  const reclaimedForm=newcomer.locator('form').filter({has:newcomer.locator('input[name="slotId"][value="'+slotId(service,moved)+'"]')});assert.equal(await reclaimedForm.count(),1,'Cancellation republishes the exact moved capacity')
  await reclaimedForm.getByLabel('Your name').fill('synthetic-mallet-43');await reclaimedForm.getByLabel('Confirmation email',{exact:true}).fill(bookingEmail(43));await reclaimedForm.getByRole('checkbox').check();await reclaimedForm.getByRole('button',{name:'Hold this time'}).click();await newcomer.waitForURL(/\/book\/[A-Za-z0-9_-]{43}$/)
  const reclaimedState=await h.state(),replacement=reclaimedState.records.appointment.find(a=>a.email===bookingEmail(43))
  assert.deepEqual({serviceId:replacement.serviceId,bayId:replacement.bayId,technicianId:replacement.technicianId,startAt:replacement.startAt,endAt:replacement.endAt,status:replacement.status},
   {serviceId:service.id,bayId:moved.bayId,technicianId:moved.technicianId,startAt:moved.startAt,endAt:moved.endAt,status:'held'})
  assert.deepEqual(reclaimedState.records.appointment.find(a=>a.id===unrelated.id),unrelated);assert.deepEqual(reclaimedState.records.appointment.find(a=>a.id===canceled.id),canceled)
  assert.equal(h.messages.filter(m=>m.subject==='Your confirmed appointment').length,mailAfterMove.length);await shot(newcomer,'booking-07b-reclaimed-capacity')
  await p.reload();assert.match(await p.locator('main').innerText(),/canceled/);await shot(p,'booking-08-staff-cancellation')
 }finally{await browser?.close();if(embedServer)await new Promise(resolve=>embedServer.close(resolve));await h.close()}
}
