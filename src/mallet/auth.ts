import { operatorAuth, runtimeBindings, type Bindings } from '../auth.server'
import {blocked,gateState,proofAuthority,type Gate} from './strong-auth/gate'
export type Actor = { id: string; name: string; role: 'owner'|'admin'|'member'|'agent' }
export type Authority = { sql: string; params: any[] }
export class HttpError extends Error { constructor(public status: number, public code: string, message = code) { super(message) } }
export const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), x => x.toString(16).padStart(2,'0')).join('')
export const human = (actor: Actor) => ['owner','admin'].includes(actor.role)
export type Identity={actor:Actor;authority:Authority;bearer:boolean;session?:{id:string;kind?:string};gate?:Gate}
// pending: the second-factor door itself, which must work before this session has shown its factor.
export async function identity(request: Request, original: Bindings, options:{pending?:boolean}={}): Promise<Identity> {
 const env=runtimeBindings(original), bearer=request.headers.get('authorization')
 if(bearer) {
  if(!/^Bearer [A-Za-z0-9_-]{43}$/.test(bearer)) throw new HttpError(401,'invalid_agent_key')
  const hash=await digest(bearer.slice(7)), now=Date.now()
  const sql="EXISTS(SELECT 1 FROM mallet_agent_keys k JOIN oa_operators o ON o.id=k.created_by WHERE k.token_hash=? AND k.revoked_at IS NULL AND k.expires_at>? AND o.status='active' AND o.version=k.creator_version AND o.role IN ('owner','admin'))"
  const key=await env.DB.prepare(`SELECT k.id,k.label FROM mallet_agent_keys k WHERE k.token_hash=? AND (${sql})`).bind(hash,hash,now).first<{id:string;label:string}>()
  if(!key) throw new HttpError(401,'invalid_agent_key')
  return {actor:{id:key.id,name:key.label,role:'agent'},authority:{sql,params:[hash,now]},bearer:true}
 }
 const session=await operatorAuth(env).getSession(request)
 if(!session) throw new HttpError(401,'sign_in_required')
 const {operator:o}=session,gate=await gateState(env,session,o.id)
 if(blocked(gate)&&!options.pending)throw new HttpError(403,'second_factor_required','Confirm with your second factor first.')
 const base:Authority={sql:"EXISTS(SELECT 1 FROM oa_sessions s JOIN oa_operators o ON o.id=s.operator_id WHERE s.id=? AND s.revoked_at IS NULL AND s.expires_at>? AND s.operator_version=o.version AND o.version=? AND o.status='active' AND o.role=?)",params:[session.id,Date.now(),o.version,o.role]}
 return {actor:{id:o.id,name:o.displayName,role:o.role},bearer:false,session:{id:session.id,kind:session.kind},gate,authority:gate.required||gate.enrolled?proofAuthority(base,session.id):base}
}
export function originGuard(request:Request, env:Bindings, bearer=false) {
 const url=new URL(request.url), origin=runtimeBindings(env).AUTH_ORIGIN
 if(url.origin!==origin || (request.headers.has('host') && request.headers.get('host')?.toLowerCase()!==url.host.toLowerCase())) throw new HttpError(403,'invalid_host')
 if(request.headers.get('sec-fetch-site')==='cross-site' || (!['GET','HEAD'].includes(request.method) && !bearer && request.headers.get('origin')!==origin)) throw new HttpError(403,'invalid_origin')
}
export async function agentKey(db:D1Database, actor:Actor, authority:Authority, command:string, input:any) {
 if(!human(actor)) throw new HttpError(403,'manager_required')
 const guard=db.prepare(`INSERT INTO mallet_assert(ok) SELECT CASE WHEN (${authority.sql}) THEN 1 ELSE 0 END`).bind(...authority.params)
 if(command==='agent.revoke') {
  await db.batch([guard,db.prepare('UPDATE mallet_agent_keys SET revoked_at=? WHERE id=?').bind(Date.now(),String(input.id)),db.prepare('DELETE FROM mallet_assert')]); return {revoked:true}
 }
 if(command!=='agent.create'&&command!=='agent.rotate') throw new HttpError(404,'unknown_command')
 // Rotation keeps the label and authority shape: the new key is created and the old one revoked in one transaction.
 const previous=command==='agent.rotate'?await db.prepare('SELECT label FROM mallet_agent_keys WHERE id=? AND revoked_at IS NULL AND expires_at>?').bind(String(input.id??''),Date.now()).first<{label:string}>():null
 if(command==='agent.rotate'&&!previous) throw new HttpError(404,'not_found')
 const label=String((previous?.label??input.label)??'').trim();if(!label || label.length>100) throw new HttpError(400,'agent_label_required')
 const token=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')
 const id=crypto.randomUUID(),now=Date.now(),expiresAt=now+30*86400000
 await db.batch([guard,...(previous?[db.prepare('INSERT INTO mallet_assert(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM mallet_agent_keys WHERE id=? AND revoked_at IS NULL) THEN 1 ELSE 0 END').bind(String(input.id))]:[]),db.prepare('INSERT INTO mallet_agent_keys SELECT ?,?,?,id,version,?,NULL,? FROM oa_operators WHERE id=?').bind(id,await digest(token),label,expiresAt,now,actor.id),...(previous?[db.prepare('UPDATE mallet_agent_keys SET revoked_at=? WHERE id=? AND revoked_at IS NULL').bind(now,String(input.id)),db.prepare('INSERT INTO oa_auth_audit(id,actor_id,action,value,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),actor.id,'mallet:agent.rotated',JSON.stringify({replaced:String(input.id),id}),now)]:[]),db.prepare('DELETE FROM mallet_assert')])
 return {id,label,token,expiresAt,...(previous?{replaced:String(input.id)}:{})}
}
