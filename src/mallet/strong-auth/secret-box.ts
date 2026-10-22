// AES-GCM envelopes for server-held secrets (TOTP seeds). The key derives from the installation's SESSION_SECRET
// with a purpose label, so a stolen database alone never reveals a seed; each envelope binds its owner as AAD.
import type {Bindings} from '../../auth.server'
const b64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')
const unb64=(text:string):Uint8Array<ArrayBuffer>=>Uint8Array.from(atob(text.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0))
async function key(env:Bindings,purpose:string){
 const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.SESSION_SECRET),'HKDF',false,['deriveKey'])
 return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:new TextEncoder().encode('mallet-secret-box'),info:new TextEncoder().encode(purpose)},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])
}
export async function seal(env:Bindings,purpose:string,aad:string,plain:Uint8Array<ArrayBuffer>){
 const iv=crypto.getRandomValues(new Uint8Array(12)),sealed=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(aad)},await key(env,purpose),plain))
 return `v1.${b64(iv)}.${b64(sealed)}`
}
export async function open(env:Bindings,purpose:string,aad:string,envelope:string){
 const [v,iv,sealed]=envelope.split('.');if(v!=='v1'||!iv||!sealed)throw Error('secret_box')
 return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(iv),additionalData:new TextEncoder().encode(aad)},await key(env,purpose),unb64(sealed)))
}
export {b64,unb64}
