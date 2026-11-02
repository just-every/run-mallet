import type {Bindings} from '../auth.server'
import {fail} from './model'

export const bytes=(s:string)=>Uint8Array.from(atob(s),x=>x.charCodeAt(0))
export const base64=(b:Uint8Array)=>btoa(String.fromCharCode(...b))
const encoder=new TextEncoder()
const path=(id:string)=>'unlock-keys/'+id
function bucket(env:Bindings){
 if(!env.INTAKE_VAULT||!env.INTAKE_VAULT_KEY)fail('VAULT_CONFIGURATION','Temporary unlock custody needs its dedicated private vault key and key bucket.',null,503)
 return env.INTAKE_VAULT
}
async function wrappingKey(env:Bindings){
 bucket(env)
 return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',encoder.encode(env.INTAKE_VAULT_KEY!)),{name:'AES-GCM'},false,['encrypt','decrypt'])
}
// Data keys live only in a private R2 bucket, outside D1 Time Travel. Never
// archive or cache them. Deleting the object makes old database copies useless.
export async function createUnlockKey(env:Bindings,id:string,expiresAt:string){
 const raw=crypto.getRandomValues(new Uint8Array(32)),iv=crypto.getRandomValues(new Uint8Array(12))
 const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(id)},await wrappingKey(env),raw)
 await bucket(env).put(path(id),JSON.stringify({iv:base64(iv),cipher:base64(new Uint8Array(cipher))}),{customMetadata:{expiresAt}})
 return crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['encrypt','decrypt'])
}
export async function readUnlockKey(env:Bindings,id:string){
 const object=await bucket(env).get(path(id))
 if(!object)fail('NOT_FOUND','This temporary secret is unavailable or its purpose has ended.',null,404)
 try{
  const stored=await object.json<{iv:string,cipher:string}>()
  const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(stored.iv),additionalData:encoder.encode(id)},await wrappingKey(env),bytes(stored.cipher))
  return await crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['encrypt','decrypt'])
 }catch{fail('NOT_FOUND','This temporary secret is unavailable or its purpose has ended.',null,404)}
}
export async function destroyUnlockKeys(env:Bindings,ids:string[]){
 if(!ids.length)return
 const store=bucket(env)
 for(let start=0;start<ids.length;start+=1000)await store.delete(ids.slice(start,start+1000).map(path))
}

// Sweep keys independently of D1, including a key whose insertion was undone
// by a database point-in-time restore. The bucket is never a backup payload.
export async function expireUnlockKeys(env:Bindings,at:string){
 if(!env.INTAKE_VAULT)return
 let cursor:string|undefined
 do{
  const page=await env.INTAKE_VAULT.list({prefix:'unlock-keys/',cursor,include:['customMetadata']})
  const expired=page.objects.filter(o=>!o.customMetadata?.expiresAt||o.customMetadata.expiresAt<=at).map(o=>o.key)
  if(expired.length)await env.INTAKE_VAULT.delete(expired)
  cursor=page.truncated?page.cursor:undefined
 }while(cursor)
}
