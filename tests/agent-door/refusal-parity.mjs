import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {draftLines,revisedLines,revisedNotes,dispatchReason} from './preparation-fixtures.mjs'

const mcpCode=answer=>answer.result?._meta?.['com.runeditrun/error']?.code??answer.message?.error?.data?.code??null

// The owner's UI command door and the agent's MCP tool refuse the same action
// on the same records with the same stable code, and neither changes a record.
async function compare(context,door,{tool,command,input,code,status,path}){
 const before=await door.state()
 const ui=path?await door.send(path):await door.send('/api/mallet/commands',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command,input})})
 const body=await ui.json()
 assert.equal(ui.status,status,`UI refusal status for ${command}`)
 assert.equal(body.error,code,`UI refusal code for ${command}`)
 const answer=await context.tool(tool,path?input:{...input,idempotency_key:randomUUID()})
 assert.equal(answer.result?.isError,true,`MCP refuses ${tool}`)
 assert.equal(answer.result?.structuredContent,undefined,`MCP refusal for ${tool} returns no record`)
 assert.equal(mcpCode(answer),body.error,`MCP returns the exact UI refusal code for ${command}`)
 assert.deepEqual((await door.state()).records,before.records,`Neither ${command} refusal changes a native record`)
 return code
}

// Stale-version, current-state and missing-record refusals for each prepared step.
export async function refusalParity(context,door,{step,job,result,estimate,dispatch}){
 const missing=randomUUID(),cases=[]
 if(step==='prepare'){
  const tool='mallet.estimates.prepare',command='estimate.prepare',lines=draftLines()
  cases.push({tool,command,input:{jobId:job.id,version:job.version,lines},code:'VERSION',status:409},
   {tool,command,input:{jobId:job.id,version:job.version+1,lines},code:'DUPLICATE',status:409},
   {tool,command,input:{jobId:missing,version:1,lines},code:'NOT_FOUND',status:404})
 }else if(step==='revise'){
  const tool='mallet.estimates.revise',command='estimate.revise',lines=revisedLines(),notes=revisedNotes
  cases.push({tool,command,input:{estimateId:estimate.id,version:estimate.version,revision:2,lines,notes},code:'VERSION',status:409},
   {tool,command,input:{estimateId:result.id,version:result.version,revision:1,lines,notes},code:'REVISION',status:409},
   {tool,command,input:{estimateId:missing,version:1,revision:1,lines,notes},code:'NOT_FOUND',status:404})
 }else if(step==='dispatch'){
  const tool='mallet.dispatch.prepare',command='dispatch.prepare',plan={...dispatch,reason:dispatchReason}
  cases.push({tool,command,input:{jobId:job.id,version:job.version-1,...plan},code:'VERSION',status:409},
   {tool,command,input:{jobId:missing,version:1,...plan},code:'NOT_FOUND',status:404})
 }else if(step==='invoice'){
  const tool='mallet.invoices.prepare',command='invoice.prepare'
  cases.push({tool,command,input:{jobId:job.id,version:job.version},code:'VERSION',status:409},
   {tool,command,input:{jobId:job.id,version:job.version+1},code:'DUPLICATE',status:409},
   {tool,command,input:{jobId:missing,version:1},code:'NOT_FOUND',status:404})
 }else if(step==='read'){
  cases.push({tool:'mallet.repairs.read',command:'repair read',path:'/api/mallet/repairs/'+missing,input:{id:missing},code:'not_found',status:404})
 }
 const codes=[]
 for(const item of cases)codes.push(await compare(context,door,item))
 return codes
}
