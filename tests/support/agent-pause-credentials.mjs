import assert from 'node:assert/strict'
import {receptionistFixture} from './assistant-journey.mjs'
import {pauseLines} from './agent-pause-journey.mjs'

// The other agent-role credentials outside the shared door: a scoped AI receptionist,
// which can book and email customers, and a native API client that can prepare drafts.
export async function otherAgentCredentials(f){
 const {h}=f,assistant=await receptionistFixture(h)
 const client=await h.command('apiClient.create',{label:'synthetic-mallet-1270',scopes:['repairs:read','estimate:prepare']})
 return {assistant,client:{as:'',headers:{authorization:'Bearer '+client.token}}}
}

export async function pausedOtherCredentials(f,o,pausedAt,label){
 const {h}=f,before=(await h.state()).records,mailCount=h.messages.length
 const attempts=[
  ['scoped assistant view','/api/mallet/assistant',o.assistant.auth],
  ['scoped assistant booking','/api/mallet/commands',{...o.assistant.auth,method:'POST',body:{command:'assistant.intake',input:o.assistant.input}}],
  ['API client read','/api/mallet/v1/repairs',o.client],
  ['API client preparation','/api/mallet/v1/preparations',{...o.client,method:'POST',headers:{...o.client.headers,'idempotency-key':'synthetic-mallet-1271'},body:{command:'estimate.prepare',input:{jobId:f.dispatch.id,version:f.dispatch.version,lines:pauseLines}}}],
 ]
 for(const [name,path,options] of attempts){
  const response=await h.request(path,options),body=await response.json()
  assert.ok(performance.now()-pausedAt<60000,'Next call is refused within sixty seconds: '+name)
  assert.equal(response.status,403,name);assert.equal(body.error,'agents_paused',name)
  assert.ok(!JSON.stringify(body).includes(f.prepare.id),'Refusal discloses no repair: '+name)
 }
 assert.deepEqual((await h.state()).records,before,'Paused credentials change no business record')
 assert.equal(h.messages.length,mailCount,'A paused assistant hands off no customer message')
 console.log('PROBE BASE-AGENT-011 '+label+': scoped AI assistant view and booking, API client read and preparation -> 403 agents_paused; unchanged records; no outbound mail')
}

export async function resumedOtherCredentials(f,o){
 const {h}=f,view=await h.api('/api/mallet/assistant',undefined,o.assistant.auth)
 assert.ok(view.slots.some(slot=>slot.slotId===o.assistant.input.slotId),'Resume restores the scoped assistant')
 const repairs=await h.api('/api/mallet/v1/repairs',undefined,o.client)
 assert.ok(repairs.data.some(row=>row.externalId===f.prepare.id),'Resume restores the API client')
}
