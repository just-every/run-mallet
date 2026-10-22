// Provider secrets: the deployment's own binding is the starting value; once the owner saves, rotates or revokes one in
// Mallet, the sealed copy governs (a revoked secret is unavailable to every provider call). Values are never returned.
import type {Bindings} from '../../auth.server'
import {HttpError,type Actor,type Authority} from '../auth'
import {open,seal} from '../strong-auth/secret-box'
import {audit} from '../strong-auth/store'
import {connector} from './registry'
const digest=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join('')
const aad=(c:string,n:string)=>`connector:${c}:${n}`
export async function connectorSecret(env:Bindings,connectorId:string,name:string):Promise<string|undefined>{
 const row=await env.DB.prepare('SELECT status,sealed FROM mallet_connector_secrets WHERE connector=? AND name=?').bind(connectorId,name).first<{status:string;sealed:string|null}>()
 if(!row)return (env as any)[name]||undefined
 if(row.status!=='active'||!row.sealed)return undefined
 return new TextDecoder().decode(await open(env,'connector',aad(connectorId,name),row.sealed))
}
export async function connectorStatus(env:Bindings){
 const rows=(await env.DB.prepare('SELECT connector,name,status,version,fingerprint,declaration_version AS declarationVersion,changed_at AS changedAt FROM mallet_connector_secrets').all<any>()).results
 return Object.fromEntries(rows.map(r=>[r.connector+':'+r.name,r]))
}
function target(input:any){
 const c=connector(String(input.connector??'')),secret=c?.secrets.find(s=>s.name===input.name)
 if(!c||!secret)throw new HttpError(404,'not_found','Unknown connector secret.')
 if(!secret.rotatable)throw new HttpError(409,'not_rotatable','This secret is managed in your Cloudflare account.')
 return {c,secret}
}
/** Owner-only, behind a fresh proof: save or rotate. The previous sealed value is overwritten and cannot be recovered. */
export async function saveSecret(env:Bindings,actor:Actor,authority:Authority,input:any){
 const {c,secret}=target(input),value=String(input.value??'')
 if(actor.role!=='owner')throw new HttpError(403,'owner_required')
 if(value.length<8||value.length>4096||/[\s\u0000-\u001f]/.test(value))throw new HttpError(400,'invalid_secret','Enter the credential exactly as your provider issued it.')
 if(Number(input.acknowledge)!==c.version)throw new HttpError(409,'declaration_not_acknowledged',`Read the ${c.name} data-flow declaration (version ${c.version}) and acknowledge it first.`)
 const previous=await env.DB.prepare('SELECT version FROM mallet_connector_secrets WHERE connector=? AND name=?').bind(c.id,secret.name).first<{version:number}>(),version=(previous?.version??0)+1,now=Date.now()
 const fingerprint=(await digest(env.SESSION_SECRET+'\0fingerprint\0'+value)).slice(0,8),sealed=await seal(env,'connector',aad(c.id,secret.name),new TextEncoder().encode(value))
 const guard=env.DB.prepare(`INSERT INTO mallet_assert(ok) SELECT CASE WHEN (${authority.sql}) THEN 1 ELSE 0 END`).bind(...authority.params)
 await env.DB.batch([guard,env.DB.prepare("INSERT INTO mallet_connector_secrets(connector,name,status,version,sealed,fingerprint,declaration_version,changed_by,changed_at) VALUES(?,?,'active',?,?,?,?,?,?) ON CONFLICT(connector,name) DO UPDATE SET status='active',version=excluded.version,sealed=excluded.sealed,fingerprint=excluded.fingerprint,declaration_version=excluded.declaration_version,changed_by=excluded.changed_by,changed_at=excluded.changed_at").bind(c.id,secret.name,version,sealed,fingerprint,c.version,actor.id,now),audit(env.DB,actor.id,previous?'connector.secret.rotated':'connector.secret.saved',{connector:c.id,name:secret.name,version,fingerprint,declarationVersion:c.version}),env.DB.prepare('DELETE FROM mallet_assert')])
 return {connector:c.id,name:secret.name,version,fingerprint}
}
export async function revokeSecret(env:Bindings,actor:Actor,authority:Authority,input:any){
 const {c,secret}=target(input)
 if(actor.role!=='owner')throw new HttpError(403,'owner_required')
 const previous=await env.DB.prepare('SELECT version FROM mallet_connector_secrets WHERE connector=? AND name=?').bind(c.id,secret.name).first<{version:number}>(),version=(previous?.version??0)+1,now=Date.now()
 const guard=env.DB.prepare(`INSERT INTO mallet_assert(ok) SELECT CASE WHEN (${authority.sql}) THEN 1 ELSE 0 END`).bind(...authority.params)
 await env.DB.batch([guard,env.DB.prepare("INSERT INTO mallet_connector_secrets(connector,name,status,version,sealed,fingerprint,declaration_version,changed_by,changed_at) VALUES(?,?,'revoked',?,NULL,NULL,?,?,?) ON CONFLICT(connector,name) DO UPDATE SET status='revoked',version=excluded.version,sealed=NULL,fingerprint=NULL,changed_by=excluded.changed_by,changed_at=excluded.changed_at").bind(c.id,secret.name,version,c.version,actor.id,now),audit(env.DB,actor.id,'connector.secret.revoked',{connector:c.id,name:secret.name,version}),env.DB.prepare('DELETE FROM mallet_assert')])
 return {connector:c.id,name:secret.name,version,status:'revoked'}
}
