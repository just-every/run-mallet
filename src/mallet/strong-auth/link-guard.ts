// Customer links are bearer capabilities. Every door that opens one answers an unknown, expired or revoked link
// the same way, and a client that keeps missing is paused so links cannot be guessed or probed at speed.
import type {Bindings} from '../../auth.server'
import {runtimeBindings} from '../../auth.server'
import {digest} from '../auth'
const WINDOW=15*60*1000,LIMIT=20
const family=(path:string)=>path.match(/^\/(approve|inspection|intake|check-in|book)\/[^/]+/)?.[1]??(/^\/portal\/confirm\//.test(path)?'portal':null)
/** Run the customer-link doors for a link path; count misses per client and door, and refuse a client past its allowance. */
export async function guardLinks(request:Request,original:Bindings,doors:()=>Promise<Response|null>):Promise<Response|null>{
 const kind=family(new URL(request.url).pathname)
 if(!kind)return doors()
 const env=runtimeBindings(original),window=Math.floor(Date.now()/WINDOW),key=await digest(env.SESSION_SECRET+'\0link-miss\0'+kind+'\0'+(request.headers.get('cf-connecting-ip')??'local'))
 const spent=await env.DB.prepare('SELECT count FROM mallet_rate WHERE key=? AND window=?').bind(key,window).first<{count:number}>()
 if(Number(spent?.count)>=LIMIT)return new Response('<!doctype html><title>Try again later</title><p>Too many attempts. Please wait a few minutes and try the link again, or ask the shop for a new one.',{status:429,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','retry-after':'900','x-robots-tag':'noindex, nofollow','referrer-policy':'no-referrer'}})
 const response=await doors()
 if(response&&[403,404].includes(response.status))await env.DB.prepare('INSERT INTO mallet_rate(key,window,count) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET window=excluded.window,count=CASE WHEN mallet_rate.window=excluded.window THEN mallet_rate.count+1 ELSE 1 END').bind(key,window).run()
 return response
}
