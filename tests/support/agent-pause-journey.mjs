import assert from 'node:assert/strict'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {authorise,booking,installation} from '../harness.mjs'
import {qualityReady} from './quality-ready.mjs'
import {localHttps} from './local-https.mjs'

let built
export async function agentPauseInstallation(){
 // Use the emitted production Worker: the lightweight workshop test entry
 // intentionally omits the shared agent dispatcher and legacy aliases.
 built??=promisify(execFile)(process.execPath,['node_modules/vite/bin/vite.js','build'],{timeout:1200000,maxBuffer:16*1024*1024})
 await built
 return installation({entry:'dist/server/index.js',network:true,secureNetwork:true,localhost:true,assets:true})
}

export const pauseLines=[{id:'synthetic-mallet-1101',kind:'labor',description:'synthetic-mallet-1102',quantity:1.25,unitCents:3200}]
export async function agentPauseFixture(h){
 const setup=await localHttps(h.origin+'/setup',{method:'POST',redirect:'manual',headers:{origin:h.origin,host:new URL(h.origin).host,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes&ratePercent=7.5&partsTaxable=yes'})
 assert.equal(setup.status,303,await setup.text())
 const owner=(await h.state()).actor
 const book=async n=>booking(h,{asset:await h.command('asset.create',{customerName:`synthetic-mallet-${n}`,customerEmail:'',label:`synthetic-mallet-${n+10}`,identifier:`synthetic-mallet-${n+20}`}),bayId:`synthetic-mallet-${n}`,startAt:`2028-11-${10+(n-1110)/30}T09:00:00Z`,endAt:`2028-11-${10+(n-1110)/30}T10:00:00Z`})
 const prepare=(await book(1110)).job,revise=(await book(1140)).job,dispatch=(await book(1170)).job,invoice=(await book(1200)).job
 const key=await h.command('agent.create',{label:'synthetic-mallet-1230'}),agent={as:'',headers:{authorization:'Bearer '+key.token}}
 let sequence=0
 const rpc=async(name,args={})=>{
  const response=await h.request('/mcp',{method:'POST',...agent,headers:{...agent.headers,'MCP-Protocol-Version':'2026-07-28','Mcp-Method':['tools','call'].join('/'),'Mcp-Name':name},body:{jsonrpc:'2.0',id:++sequence,method:['tools','call'].join('/'),params:{name,arguments:args,_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28'}}}})
  assert.equal(response.status,200,name)
  return response.json()
 }
 const done=async(name,args)=>{
  const body=await rpc(name,args)
  assert.equal(body.error,undefined,name);assert.equal(body.result.isError,false,JSON.stringify(body.result))
  assert.equal(body.result._meta['com.runeditrun/decision'].disposition,'autonomous')
  return body.result.structuredContent
 }
 // Configure through the owner door, without private database fixtures.
 const policy=await h.request('/agents/api/policy',{method:'PUT',body:{document:{schema:'rer-agent-policy/1',catalogue:'rer-agent-classes/1',rules:[{id:'synthetic-mallet-1231',class:'*',do:'autonomous'}],spend:{none:true}}}})
 assert.equal(policy.status,200,await policy.text())
 const cachedArgs={jobId:revise.id,version:revise.version,lines:pauseLines,idempotency_key:'synthetic-mallet-1232'}
 const draft=await done('mallet.estimates.prepare',cachedArgs)
 const q=await authorise(h,await h.command('estimate.prepare',{jobId:invoice.id,version:invoice.version,lines:pauseLines}))
 let completed=(await h.state()).records.job.find(row=>row.id===invoice.id)
 await h.command('work.record',{jobId:completed.id,version:completed.version,estimateId:q.id,revision:1,lineId:'synthetic-mallet-1101',quantity:1.25})
 completed=(await h.state()).records.job.find(row=>row.id===invoice.id)
 await qualityReady(h,completed)
 await h.command('job.complete',{jobId:completed.id,version:completed.version})
 completed=(await h.state()).records.job.find(row=>row.id===invoice.id)
 assert.equal(completed.status,'completed');assert.equal(completed.invoiceId,null)
 assert.equal(completed.actuals[0].quantityMilli,1250)
 const list=await done('mallet.repairs.list',{}),read=await done('mallet.repairs.read',{id:prepare.id})
 assert.equal(list.records.job.length,4)
 assert.ok(read.records.job.some(row=>row.id===prepare.id))
 assert.ok(JSON.stringify(read).includes('synthetic-mallet-1110'),'Positive read contains real private repair data')
 const calls=[
  {name:'mallet.estimates.prepare',command:'estimate.prepare',args:{jobId:prepare.id,version:prepare.version,lines:pauseLines,idempotency_key:'synthetic-mallet-1233'}},
  {name:'mallet.estimates.revise',command:'estimate.revise',args:{estimateId:draft.id,version:draft.version,revision:1,lines:[{...pauseLines[0],quantity:2}],idempotency_key:'synthetic-mallet-1234'}},
  {name:'mallet.dispatch.prepare',command:'dispatch.prepare',args:{jobId:dispatch.id,version:dispatch.version,bayId:'synthetic-mallet-1235',technicianId:owner.id,startAt:'2028-11-14T09:00:00Z',endAt:'2028-11-14T10:00:00Z',reason:'synthetic-mallet-1236',idempotency_key:'synthetic-mallet-1237'}},
  {name:'mallet.invoices.prepare',command:'invoice.prepare',args:{jobId:completed.id,version:completed.version,idempotency_key:'synthetic-mallet-1238'}},
  {name:'mallet.repairs.list',path:'/api/mallet/state',args:{}},
  {name:'mallet.repairs.read',path:'/api/mallet/repairs/'+prepare.id,args:{id:prepare.id}},
 ]
 return {h,owner,key,agent,prepare,dispatch,draft,cachedArgs,calls,rpc,done}
}

// Every retained audit row, page by page, so a later Pause counts only its own refusals.
export async function auditRows(h){
 const rows=[]
 for(let after='0';;){const page=await h.api('/agents/api/audit?after='+after);if(!page.rows.length)return rows;rows.push(...page.rows);after=page.cursor}
}

export async function pausedAgentCalls(f,pausedAt,label='6'){
 const {h,agent}=f,before=(await h.state()).records,mailCount=h.messages.length,earlier=(await auditRows(h)).length
 let slowest=0
 const privateValues=[f.prepare.id,f.draft.id,'synthetic-mallet-1110','synthetic-mallet-1102']
 const attempts=[...f.calls,{name:'mallet.estimates.prepare',command:'estimate.prepare',args:f.cachedArgs}]
 for(const call of attempts){
  const body=await f.rpc(call.name,call.args),elapsed=performance.now()-pausedAt
  slowest=Math.max(slowest,elapsed)
  assert.ok(elapsed<60000,'Next call is refused within sixty seconds: '+call.name)
  assert.equal(body.result?.isError,true,call.name)
  assert.equal(body.result._meta['com.runeditrun/error'].code,'agents_paused',call.name)
  assert.equal(body.result.structuredContent,undefined,'Pause discloses no private or cached result')
  for(const value of privateValues)assert.ok(!JSON.stringify(body).includes(value),'Refusal excludes retained private content')
  assert.deepEqual((await h.state()).records,before,'Paused MCP call leaves every business record unchanged: '+call.name)
 }
 for(const call of attempts){
  const {idempotency_key,...input}=call.args
  const response=await h.request(call.path??'/api/mallet/commands',{...agent,...(call.command?{method:'POST',body:{command:call.command,input},headers:{...agent.headers,'idempotency-key':idempotency_key}}:{})})
  const body=await response.json(),elapsed=performance.now()-pausedAt
  slowest=Math.max(slowest,elapsed)
  assert.ok(elapsed<60000,'Legacy call is refused within sixty seconds')
  assert.equal(response.status,403,call.command??call.path)
  assert.deepEqual(body,{code:'agents_paused'})
  assert.deepEqual((await h.state()).records,before,'Legacy route cannot bypass Pause: '+(call.command??call.path))
 }
 const audit=(await auditRows(h)).slice(earlier)
 assert.equal(audit.length,attempts.length*2)
 for(const row of audit){assert.equal(row.code,'agents_paused');assert.equal(row.classification_refusal,undefined,'Paused call uses a resolvable native target');assert.equal(row.classes[0].class,'standard')}
 assert.equal(h.messages.length,mailCount,'Pause hands off no outbound messages')
 console.log('PROBE BASE-AGENT-011 '+label+': six MCP tools and six legacy routes with cached preparation replay on both transports -> agents_paused; unchanged business records; next-call maximum '+Math.ceil(slowest)+' ms')
}

export async function refusedAgentResume(f){
 const before=(await f.h.state()).records
 for(const credential of [{...f.agent,as:f.h.owner},f.agent]){
  const response=await f.h.request('/agents/api/pause',{method:'POST',body:{paused:false},...credential})
  assert.equal(response.status,403)
  assert.deepEqual(await response.json(),{code:'person_session_required'})
  assert.deepEqual((await f.h.api('/agents/api/state')).paused,{business:false,local:true})
  assert.deepEqual((await f.h.state()).records,before)
 }
 assert.equal((await f.rpc('mallet.repairs.read',{id:f.prepare.id})).result._meta['com.runeditrun/error'].code,'agents_paused')
 console.log('PROBE BASE-AGENT-011 7: preparation bearer POST to resume -> 403 person_session_required; Pause remains active; repair read still refused')
}

export async function resumedPreparation(f){
 const before=(await f.h.state()).records,input=f.calls[0].args
 const result=await f.done('mallet.estimates.prepare',input)
 const after=(await f.h.state()).records,saved=after.estimate.find(row=>row.id===result.id),revision=saved.revisions[0]
 assert.equal(after.estimate.length,before.estimate.length+1)
 assert.equal(saved.jobId,f.prepare.id);assert.equal(saved.status,'draft');assert.equal(saved.revisions.length,1)
 assert.deepEqual(revision.lines.map(({id,kind,description,quantity,quantityMilli,unitCents,subtotalCents,salesTaxCents,totalCents})=>({id,kind,description,quantity,quantityMilli,unitCents,subtotalCents,salesTaxCents,totalCents})),[{id:'synthetic-mallet-1101',kind:'labor',description:'synthetic-mallet-1102',quantity:1.25,quantityMilli:1250,unitCents:3200,subtotalCents:4000,salesTaxCents:0,totalCents:4000}])
 assert.equal(revision.totals.totalCents,4000)
 assert.equal(revision.preparedBy.attribution.agent.id,'mallet-key:'+f.key.id)
 assert.deepEqual(after.estimate.find(row=>row.id===f.draft.id),f.draft,'Pause never revised the other draft')
 assert.deepEqual(await f.done('mallet.estimates.prepare',input),result,'Resume preserves exactly one effect on replay')
 assert.deepEqual((await f.h.state()).records,after)
 assert.equal(after.event.filter(row=>row.kind==='estimate.prepare'&&row.jobId===f.prepare.id).length,1)
 assert.ok((await f.done('mallet.repairs.read',{id:f.prepare.id})).records.estimate.some(row=>row.id===saved.id))
 console.log('PROBE BASE-AGENT-011 6 resume: owner form then MCP preparation and retry -> one saved draft, exact 1250 thousandths, 4000 cents and one preparation event')
 return saved
}
