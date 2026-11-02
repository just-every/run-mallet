import type {Bindings} from '../../auth.server'
import {bytes,readUnlockKey} from '../intake-vault'
import {fail} from '../model'

/** Never let an owner paste a currently held unlock value into a receipt.
 * Decryption stays in this request; nothing is returned, logged or archived. */
export async function refuseSecretEcho(env:Bindings,descriptions:string[]){
 const secrets=await env.DB.prepare('SELECT id,job_id,iv,cipher FROM mallet_intake_secrets').all<{id:string;job_id:string;iv:string;cipher:string}>()
 for(const row of secrets.results){
  let secret:string
  try{secret=new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(row.iv),additionalData:new TextEncoder().encode(row.job_id+':'+row.id)},await readUnlockKey(env,row.id),bytes(row.cipher)))}
  catch(error){if((error as any)?.code==='NOT_FOUND')continue;throw error}
  if(descriptions.some(v=>v.includes(secret)||(secret.trim()&&v.includes(secret.trim()))))fail('SECRET_ECHO','A retention reason, reference or consent record must not contain an unlock value.',null,400)
 }
}
