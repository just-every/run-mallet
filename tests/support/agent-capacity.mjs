import assert from 'node:assert/strict'
import {auditRows} from './agent-pause-journey.mjs'

const meta={'io.modelcontextprotocol/protocolVersion':'2026-07-28'}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))

// Capacity is counted per agent and per minute: it protects the installation and
// is not company policy. A second preparation key overruns it while the first works.
export async function rateOverrun(f){
 const {h}=f,key=await h.command('agent.create',{label:'synthetic-mallet-1250'})
 const agent={as:'',headers:{authorization:'Bearer '+key.token}},list=['tools','list'].join('/'),call=['tools','call'].join('/')
 const rpc=(method,params={},name)=>h.request('/mcp',{method:'POST',...agent,headers:{...agent.headers,'MCP-Protocol-Version':'2026-07-28','Mcp-Method':method,...(name?{'Mcp-Name':name}:{})},body:{jsonrpc:'2.0',id:1,method,params:{...params,_meta:meta}}})
 // Refused requests are not counted, so a burst that straddles one minute boundary
 // still overruns within 1,225 requests. A window with under five seconds left is
 // allowed to pass first, so the refusals below are read inside one counted minute.
 const exhaust=async()=>{
  for(;;){
   let limited
   for(let sent=0;!limited&&sent<1225;sent+=25){
    for(const response of await Promise.all(Array.from({length:25},()=>rpc(list)))){
     if(response.status===429)limited??=response
     else assert.equal(response.status,200,'Within capacity, listing tools succeeds')
    }
   }
   assert.ok(limited,'A rate overrun returns 429')
   const retry=Number(limited.headers.get('retry-after'))
   assert.ok(Number.isInteger(retry)&&retry>=1&&retry<=60,'Retry-After names the seconds until capacity returns')
   assert.equal((await limited.json()).error.data.code,'rate_limited')
   if(retry>=5)return retry
   await pause((retry+1)*1000)
  }
 }
 await exhaust()
 const before=(await h.state()).records,invoice=f.calls[3]
 const refused=await rpc(call,{name:invoice.name,arguments:{...invoice.args,idempotency_key:'synthetic-mallet-1251'}},invoice.name)
 assert.equal(refused.status,429)
 const retry=Number(refused.headers.get('retry-after'))
 assert.ok(Number.isInteger(retry)&&retry>=1&&retry<=60)
 assert.equal((await refused.json()).error.data.code,'rate_limited')
 const {idempotency_key:_key,...input}=invoice.args
 const legacy=await h.request('/api/mallet/commands',{method:'POST',...agent,headers:{...agent.headers,'idempotency-key':'synthetic-mallet-1252'},body:{command:invoice.command,input}})
 assert.equal(legacy.status,429,'The REST preparation route shares the same capacity')
 const legacyRetry=Number(legacy.headers.get('retry-after'))
 assert.ok(Number.isInteger(legacyRetry)&&legacyRetry>=1&&legacyRetry<=60,'The REST preparation route returns Retry-After too')
 assert.deepEqual(await legacy.json(),{code:'rate_limited'})
 assert.deepEqual((await h.state()).records,before,'A refused overrun runs nothing')
 assert.equal((await auditRows(h)).filter(row=>row.agent.id==='mallet-key:'+key.id).length,0,'Overrun calls never reach policy or a native action')
 // Capacity bounds one agent's rate, never the shop's work: the first key and the owner's session continue.
 assert.ok((await f.done('mallet.repairs.read',{id:f.prepare.id})).records.job.some(row=>row.id===f.prepare.id))
 assert.equal((await h.api('/agents/api/state')).paused.local,false)
 console.log('PROBE BASE-AGENT-011 1: second preparation key over 600 requests per minute on MCP and the REST preparation route -> 429 rate_limited with Retry-After '+legacyRetry+' s; no audit row or record change; first key and owner session continue')
 return key
}
