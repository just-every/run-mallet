import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {nativePeer} from './preparation-parity.mjs'
import {nativeDoor} from './preparation-fixtures.mjs'
import {totpCode} from '../support/second-factor.mjs'
import {autonomousPolicy,heldPolicy} from '../../src/modules/agent-door/conformance/crypto.mjs'
import prompts,{beforeStep,afterStep} from './prompts.mjs'

export {beforeStep,afterStep}
const rows=(state,kind)=>state.records[kind]??[]
const lines=()=>[{kind:'labor',description:'synthetic-mallet-970 private brake draft',quantity:2,unitCents:4500}]
const snapshot=state=>({version:state.version,records:state.records,events:state.events})

async function invite(peer){
 const email=['synthetic-mallet-971','example.invalid'].join('@')
 const response=await peer.door.send('/auth/invite',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,displayName:'synthetic-mallet-971 sponsor',role:'admin'})})
 assert.equal(response.status,202,'Owner invites the second native admin');await response.body?.cancel()
 const message=peer.messages.findLast(value=>JSON.stringify(value.to).includes(email))
 assert.ok(message,'The second invitation reaches the controlled mail edge')
 const link=new URL(message.text.match(/https:\/\/[^\s]+/)[0])
 assert.equal(link.origin,peer.door.origin);assert.equal(link.pathname,'/auth/confirm')
 const confirmed=await peer.door.request(peer.door.origin+'/auth/confirm',{method:'POST',redirect:'manual',headers:{Origin:peer.door.origin,'Content-Type':'application/json'},body:JSON.stringify({token:link.searchParams.get('token')})})
 assert.equal(confirmed.status,303,'The second native admin confirms the issued invitation')
 const cookie=confirmed.headers.getSetCookie().map(value=>value.split(';',1)[0]).join('; ')
 await confirmed.body?.cancel()
 return {cookie}
}

async function credential(peer,session,change){
 const door=nativeDoor({...peer.door,cookie:session.cookie})
 const person=(await door.json('/auth/session')).operator
 assert.equal(person.role,'admin');assert.equal(person.status,'active')
 const factor=await door.json('/api/mallet/security/totp/begin',{})
 await door.json('/api/mallet/security/totp/confirm',{code:totpCode(factor.secret)})
 const key=await door.command('agent.create',{label:`synthetic-mallet-972 ${change}`})
 assert.ok(key.id&&key.token,'A freshly confirmed native admin issues its own preparation key')
 return {person,key,change,cases:[]}
}

async function rpc(door,key,name,args){
 const response=await door.send('/mcp',{method:'POST',headers:{Cookie:'',Authorization:`Bearer ${key.token}`,'Content-Type':'application/json','MCP-Protocol-Version':'2026-07-28','Mcp-Method':'tools/call','Mcp-Name':name},body:JSON.stringify({jsonrpc:'2.0',id:randomUUID(),method:'tools/call',params:{name,arguments:args,_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28'}}})})
 const text=await response.text()
 return {status:response.status,body:JSON.parse(text),text}
}
async function tool(door,key,name,args,phase){
 const answer=await rpc(door,key,name,args)
 assert.equal(answer.status,200,'Active sponsor MCP call succeeds')
 assert.ok(!answer.body.error&&!answer.body.result.isError,'Active sponsor gets a successful tool result')
 assert.equal(answer.body.result._meta['com.runeditrun/decision'].disposition,phase==='held'?'review':'autonomous')
 return answer.body.result.structuredContent
}
async function legacy(door,key,path,body,idempotencyKey){
 const response=await door.send(path,{method:body===undefined?'GET':'POST',headers:{Cookie:'',Authorization:`Bearer ${key.token}`,'Content-Type':'application/json',...(idempotencyKey?{'Idempotency-Key':idempotencyKey}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})})
 const text=await response.text()
 return {status:response.status,body:JSON.parse(text),text}
}
async function repair(door,index){
 const actor=(await door.state()).actor
 const asset=await door.command('asset.create',{customerName:`synthetic-mallet-${980+index} private customer`,customerEmail:'',label:'Private shop bicycle',identifier:`synthetic-mallet-${980+index}`})
 return door.command('job.book',{assetId:asset.id,version:asset.version,title:`synthetic-mallet-${990+index} private repair`,technicianId:actor.id,bayId:`synthetic-mallet-${1000+index}`,startAt:`2028-11-${10+index}T09:00:00Z`,endAt:`2028-11-${10+index}T10:00:00Z`})
}
function assertDraft(saved,input,by){
 assert.equal(saved.jobId,input.jobId);assert.equal(saved.status,'draft');assert.equal(saved.version,1)
 assert.equal(saved.revisions.length,1)
 assert.deepEqual(saved.revisions[0].lines.map(({kind,description,quantity,unitCents})=>({kind,description,quantity,unitCents})),lines())
 assert.deepEqual(saved.revisions[0].totals,{currency:'USD',subtotalCents:9000,salesTaxCents:900,totalCents:9900})
 assert.deepEqual(saved.revisions[0].preparedBy,by)
 assert.equal(saved.revisions[0].approval,null);assert.equal(saved.authorisation,null);assert.deepEqual(saved.sent,[])
}

/** Actual issued local keys, both company policies, and native owner revocation doors. */
export async function sponsorAdmission({proof}={}){
 const peer=await nativePeer(),door=peer.door
 try{
  const sponsors=[await credential(peer,peer.reviewer,'downgrade'),await credential(peer,await invite(peer),'suspend')]
  const cases=[];let index=0
  const configure=async phase=>{
   const response=await door.send('/agents/api/policy',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({document:phase==='held'?heldPolicy():autonomousPolicy()})})
   assert.equal(response.status,200);await response.body?.cancel()
  }
  const mailCount=peer.messages.length
  for(const phase of ['autonomous','held']){
   await configure(phase)
   for(const sponsor of sponsors){
    const job=await repair(door,index++),legacyJob=await repair(door,index++),fresh=await repair(door,index++)
    const args={jobId:job.id,version:job.version,lines:lines(),idempotency_key:randomUUID(),expected_revision:job.version}
    const input={jobId:legacyJob.id,version:legacyJob.version,lines:lines()},legacyKey=randomUUID()
    const before=await door.state()
    const listed=await tool(door,sponsor.key,'mallet.repairs.list',{},phase)
    assert.deepEqual(rows(listed,'job').find(row=>row.id===job.id),rows(before,'job').find(row=>row.id===job.id),'Active admin reads the exact independently seeded repair')
    const saved=await tool(door,sponsor.key,'mallet.estimates.prepare',args,phase)
    const attribution={agent:{id:`mallet-key:${sponsor.key.id}`,name:sponsor.key.label},for:{id:sponsor.person.id,name:sponsor.person.displayName},label:`${sponsor.key.label} for ${sponsor.person.displayName}`}
    assertDraft(saved,args,{id:attribution.agent.id,name:attribution.label,role:'agent',attribution,policyApprovers:[]})
    const legacyAnswer=await legacy(door,sponsor.key,'/api/mallet/commands',{command:'estimate.prepare',input},legacyKey)
    assert.equal(legacyAnswer.status,200,'Active admin key prepares through the legacy command door')
    assertDraft(legacyAnswer.body,input,{id:attribution.agent.id,name:attribution.label,role:'agent',attribution,policyApprovers:[]})
    const current=await door.state(),read=await tool(door,sponsor.key,'mallet.repairs.read',{id:job.id},phase)
    assert.deepEqual(rows(read,'job').find(row=>row.id===job.id),rows(current,'job').find(row=>row.id===job.id))
    assert.deepEqual(rows(read,'estimate').find(row=>row.id===saved.id),saved,'Repair read returns the exact persisted draft with sponsor attribution')
    const legacyRead=await legacy(door,sponsor.key,'/api/mallet/state')
    assert.equal(legacyRead.status,200)
    assert.deepEqual(rows(legacyRead.body,'estimate').find(row=>row.id===legacyAnswer.body.id),legacyAnswer.body)
    const legacyRepair=await legacy(door,sponsor.key,'/api/mallet/repairs/'+legacyJob.id)
    assert.equal(legacyRepair.status,200)
    assert.deepEqual(rows(legacyRepair.body,'job').find(row=>row.id===legacyJob.id),rows(current,'job').find(row=>row.id===legacyJob.id))
    assert.deepEqual(rows(legacyRepair.body,'estimate').find(row=>row.id===legacyAnswer.body.id),legacyAnswer.body)
    const beforeReplay=snapshot(await door.state())
    assert.deepEqual(await tool(door,sponsor.key,'mallet.estimates.prepare',args,phase),saved,'A live sponsor can replay its exact successful MCP preparation')
    const legacyReplay=await legacy(door,sponsor.key,'/api/mallet/commands',{command:'estimate.prepare',input},legacyKey)
    assert.equal(legacyReplay.status,200)
    assert.deepEqual(legacyReplay.body,legacyAnswer.body,'A live sponsor can replay its exact successful legacy preparation')
    assert.deepEqual(snapshot(await door.state()),beforeReplay,'Successful replay produces no duplicate business effects')
    const entry={phase,sponsor,job,legacyJob,fresh,args,input,legacyKey,saved,legacySaved:legacyAnswer.body}
    cases.push(entry);sponsor.cases.push(entry)
    console.log(`PROBE BASE-AGENT-005 point-3 ${phase} ${sponsor.change} allowed: issued admin key -> exact MCP and legacy repair reads and estimate drafts, original attribution, successful replay through both transports without duplicate effects`)
   }
  }
  assert.equal(peer.messages.length,mailCount,'Preparation and read calls hand off no mail')
  await proof?.({stage:'allowed',door,sponsors,cases})
  for(const sponsor of sponsors){
   const unchanged=snapshot(await door.state())
   await door.json(sponsor.change==='downgrade'?'/auth/operator/role':'/auth/operator/status',sponsor.change==='downgrade'?{operatorId:sponsor.person.id,role:'member'}:{operatorId:sponsor.person.id,status:'inactive'})
   const people=await door.json('/auth/operators'),person=people.find(person=>person.id===sponsor.person.id)
   assert.equal(person.role,sponsor.change==='downgrade'?'member':'admin')
   assert.equal(person.status,sponsor.change==='suspend'?'inactive':'active')
   assert.deepEqual(snapshot(await door.state()),unchanged,'Sponsor changes preserve all existing drafts and business history')
   for(const entry of sponsor.cases){
    await configure(entry.phase)
    const before=snapshot(await door.state()),outbound=peer.messages.length
    const privateValues=[entry.job.id,entry.saved.id,entry.saved.revisions[0].lines[0].description,entry.legacySaved.id,entry.sponsor.person.id,entry.sponsor.key.token]
    const refused=answer=>{
     assert.equal(answer.status,401,'Changed sponsor is refused before reads, writes or cached-result replay')
     for(const value of privateValues)assert.ok(!answer.text.includes(value),'Unauthorized response contains no private draft, sponsor or credential content')
     assert.equal(answer.body.result,undefined,'No cached MCP result is returned')
    }
    refused(await rpc(door,sponsor.key,'mallet.repairs.read',{id:entry.job.id}))
    refused(await rpc(door,sponsor.key,'mallet.repairs.list',{}))
    refused(await rpc(door,sponsor.key,'mallet.estimates.prepare',entry.args))
    const freshArgs={jobId:entry.fresh.id,version:entry.fresh.version,lines:lines()}
    refused(await rpc(door,sponsor.key,'mallet.estimates.prepare',{...freshArgs,idempotency_key:randomUUID(),expected_revision:entry.fresh.version}))
    refused(await rpc(door,sponsor.key,'mallet.estimates.revise',{estimateId:entry.saved.id,version:entry.saved.version,revision:1,lines:lines(),idempotency_key:randomUUID(),expected_revision:entry.saved.version}))
    refused(await legacy(door,sponsor.key,'/api/mallet/state'))
    refused(await legacy(door,sponsor.key,'/api/mallet/repairs/'+entry.legacyJob.id))
    refused(await legacy(door,sponsor.key,'/api/mallet/commands',{command:'estimate.prepare',input:entry.input},entry.legacyKey))
    refused(await legacy(door,sponsor.key,'/api/mallet/commands',{command:'estimate.prepare',input:freshArgs}))
    refused(await legacy(door,sponsor.key,'/api/mallet/commands',{command:'estimate.revise',input:{estimateId:entry.legacySaved.id,version:entry.legacySaved.version,revision:1,lines:lines()}}))
    assert.deepEqual(snapshot(await door.state()),before,'All refused calls preserve every business record, version, event, decision and original attribution')
    assert.equal(peer.messages.length,outbound,'No refused call creates an outbound handoff')
    console.log(`PROBE BASE-AGENT-005 point-3 ${entry.phase} ${sponsor.change} denied: owner native ${sponsor.change==='downgrade'?'role':'status'} door -> next MCP and legacy reads, fresh preparation, revision and captured-success replay all 401; no private content, business changes or mail`)
   }
  }
  const final=await door.state()
  for(const entry of cases){
   assert.deepEqual(rows(final,'estimate').find(row=>row.id===entry.saved.id),entry.saved)
   assert.deepEqual(rows(final,'estimate').find(row=>row.id===entry.legacySaved.id),entry.legacySaved)
   // The same current input that the old key cannot use remains valid for the owner.
   const prepared=await door.command('estimate.prepare',{jobId:entry.fresh.id,version:entry.fresh.version,lines:lines()})
   assert.equal(prepared.status,'draft')
  }
  assert.equal(peer.messages.length,mailCount)
  await proof?.({stage:'refused',door,sponsors,cases})
 }finally{await peer.close()}
}

export default async function journey(context){
 await prompts(context)
 await sponsorAdmission()
}
