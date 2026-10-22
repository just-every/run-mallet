import type {Bindings} from '../../auth.server'
import {b64,unb64} from '../strong-auth/secret-box'
const encoder=new TextEncoder()
const key=(env:Bindings)=>crypto.subtle.importKey('raw',encoder.encode(env.SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign','verify'])
const payload=(linkId:string,mediaId:string,sha:string,until:number)=>encoder.encode(JSON.stringify(['mallet-media-bytes',linkId,mediaId,sha,until]))
/** Five-minute byte authority, scoped to this exact reviewed file; the parent link is checked again on every read. */
export async function byteURL(env:Bindings,base:string,link:any,media:any){
 const until=Math.min(Date.now()+5*60*1000,Date.parse(link.expiresAt)),signature=b64(new Uint8Array(await crypto.subtle.sign('HMAC',await key(env),payload(link.id,media.id,media.sha256,until))))
 return `${base}/media/${encodeURIComponent(media.id)}?until=${until}&proof=${signature}`
}
export async function authorizedBytes(env:Bindings,url:URL,link:any,media:any){
 const until=Number(url.searchParams.get('until')),proof=url.searchParams.get('proof')??''
 if(!Number.isSafeInteger(until)||until<=Date.now()||until>Date.now()+5*60*1000||until>Date.parse(link.expiresAt)||!/^[A-Za-z0-9_-]{43}$/.test(proof))return false
 try{return await crypto.subtle.verify('HMAC',await key(env),unb64(proof),payload(link.id,media.id,media.sha256,until))}catch{return false}
}
