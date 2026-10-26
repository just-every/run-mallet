import type {Bindings} from '../../auth.server'
import {digest,HttpError,type Identity,type Authority} from '../auth'
import {requireStepUp} from '../strong-auth/gate'
import {configuredProviders} from './config'
import {createOperatorAuth} from '../../modules/operator-auth/index.mjs'
export type Connection={provider:string;issuer:string;client_id:string;revision:number;owner_id:string;owner_version:number;token_hash:string;enabled:number}
export const connectionFence=(c:Connection):Authority=>({sql:"EXISTS(SELECT 1 FROM mallet_enterprise_connections c JOIN oa_operators o ON o.id=c.owner_id WHERE c.provider=? AND c.revision=? AND c.enabled=1 AND c.token_hash=? AND o.role='owner' AND o.status='active' AND o.version=c.owner_version)",params:[c.provider,c.revision,c.token_hash]})
export function assertion(db:D1Database,a:Authority){return db.prepare(`INSERT INTO mallet_assert(ok) SELECT CASE WHEN (${a.sql}) THEN 1 ELSE 0 END`).bind(...a.params)}
export function audit(db:D1Database,actor:string,action:string,evidence:any){const id=crypto.randomUUID(),at=new Date().toISOString();return db.prepare("INSERT INTO mallet_records(kind,id,revision,value) SELECT 'audit',?,1,json_set(?,'$.actor',json_object('id',id,'name',display_name,'role',role)) FROM oa_operators WHERE id=?").bind(id,JSON.stringify({id,version:1,at,action,policy:'enterprise-explicit-technician-v1',changes:evidence.changes??[],evidence:[evidence]}),actor)}
export async function configureConnection(env:Bindings,auth:Identity,action:string,input:any){
 if(auth.actor.role!=='owner'||auth.bearer)throw new HttpError(403,'owner_required')
 if(!auth.gate?.enrolled)throw new HttpError(403,'owner_factor_required')
 const authority=requireStepUp(auth),p=configuredProviders(env).find(p=>p.id===input.provider)
 if(!p)throw new HttpError(400,'configured_provider_required')
 if(action!=='revoke'){try{createOperatorAuth({db:env.DB,clientIp:()=>'',config:{origin:env.AUTH_ORIGIN,local:env.AUTH_LOCAL==='true',OWNER_EMAIL:env.OWNER_EMAIL,SESSION_SECRET:env.SESSION_SECRET,OIDC_TRANSACTION_SECRET:env.OIDC_TRANSACTION_SECRET,providers:[p]}})}catch{throw new HttpError(400,'invalid_enterprise_configuration')}}
 const reason=String(input.reason??'').trim()
 if(input.consent!=='yes'||!reason||reason.length>500)throw new HttpError(400,'explicit_consent_required')
 if(action==='enable'&&(input.role!=='technician'||input.location!=='shop'))throw new HttpError(403,'mapping_refused')
 const current=await env.DB.prepare('SELECT * FROM mallet_enterprise_connections WHERE provider=?').bind(p.id).first<Connection>()
 if(action!=='enable'&&!current)throw new HttpError(404,'not_found')
 if(!['enable','rotate','revoke'].includes(action))throw new HttpError(404,'not_found')
 const token=action==='revoke'?null:btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=',''),hash=token?await digest(token):null,revision=(current?.revision??0)+1
 await env.DB.batch([assertion(env.DB,authority),env.DB.prepare('INSERT INTO mallet_assert(ok) SELECT CASE WHEN COALESCE((SELECT revision FROM mallet_enterprise_connections WHERE provider=?),0)=? THEN 1 ELSE 0 END').bind(p.id,current?.revision??0),
 env.DB.prepare("INSERT INTO mallet_enterprise_connections(provider,issuer,client_id,enabled,revision,token_hash,owner_id,owner_version,role,location,reason,approved_at) SELECT ?,?,?,?,?,?,id,version,'technician','shop',?,? FROM oa_operators WHERE id=? ON CONFLICT(provider) DO UPDATE SET issuer=excluded.issuer,client_id=excluded.client_id,enabled=excluded.enabled,revision=excluded.revision,token_hash=excluded.token_hash,owner_id=excluded.owner_id,owner_version=excluded.owner_version,reason=excluded.reason,approved_at=excluded.approved_at").bind(p.id,p.issuer,p.clientId,action==='revoke'?0:1,revision,hash,reason,Date.now(),auth.actor.id),
 ...(action==='revoke'?[env.DB.prepare('UPDATE mallet_enterprise_users SET active=0,revision=revision+1 WHERE provider=?').bind(p.id)]:[]),
 ...(action==='enable'?[env.DB.prepare('INSERT INTO oa_auth_settings(singleton,idp_sign_in,generation,first_setup) VALUES(1,1,1,0) ON CONFLICT(singleton) DO UPDATE SET idp_sign_in=1,generation=generation+1,first_setup=0')]:[]),
 audit(env.DB,auth.actor.id,'enterprise.'+action,{provider:p.id,role:'technician',location:'shop',reason,revision,changes:[{kind:'enterpriseConnection',id:p.id,beforeRevision:current?.revision??null,afterRevision:revision}]}),env.DB.prepare('DELETE FROM mallet_assert')])
 return {provider:p.id,revision,...(token?{token}:{revoked:true})}
}
export async function scimConnection(env:Bindings,request:Request,provider:string){
 const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1]
 if(!token)throw new HttpError(401,'invalid_scim_credential')
 const c=await env.DB.prepare("SELECT c.* FROM mallet_enterprise_connections c JOIN oa_operators o ON o.id=c.owner_id WHERE c.provider=? AND c.enabled=1 AND c.token_hash=? AND o.role='owner' AND o.status='active' AND o.version=c.owner_version").bind(provider,await digest(token)).first<Connection>()
 const p=configuredProviders(env).find(p=>p.id===provider)
 if(!c||!p||c.issuer!==p.issuer||c.client_id!==p.clientId)throw new HttpError(401,'invalid_scim_credential')
 return c
}
