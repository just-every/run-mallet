import type {Bindings} from '../../auth.server'
import {configuredProviders} from './config'
// Every read repeats current employment and exact provider provenance; old native cookies never bypass SSO.
export async function enterpriseSessionAllowed(env:Bindings,session:any):Promise<boolean>{
 if(!session)return false
 const user=await env.DB.prepare('SELECT * FROM mallet_enterprise_users WHERE id=?').bind(session.operator.id).first<any>()
 const pin=await env.DB.prepare('SELECT * FROM oa_provider_session_pins WHERE session_id=?').bind(session.id).first<any>()
 if(!user)return !pin?.provider_id?.startsWith('enterprise-')
 if(!user.active||session.operator.role!=='member'||session.kind!=='oidc'||pin?.provider_id!==user.provider)return false
 const connection=await env.DB.prepare("SELECT c.* FROM mallet_enterprise_connections c JOIN oa_operators o ON o.id=c.owner_id WHERE c.provider=? AND c.enabled=1 AND o.status='active' AND o.role='owner' AND o.version=c.owner_version").bind(user.provider).first<any>()
 const provider=configuredProviders(env).find(p=>p.id===user.provider)
 return !!connection&&!!provider&&provider.issuer===connection.issuer&&provider.clientId===connection.client_id&&pin.issuer===connection.issuer&&pin.client_id===connection.client_id&&!!await env.DB.prepare('SELECT 1 FROM oa_provider_sessions WHERE session_id=? AND issuer=? AND subject=?').bind(session.id,connection.issuer,user.external_id).first()
}
export function enterpriseHooks(env:Bindings){return {
 beforeMagicLink:async({email}:any)=>!await env.DB.prepare('SELECT 1 FROM mallet_enterprise_users WHERE email=?').bind(email).first(),
 afterConfirm:async({session,operator}:any)=>{if(!await enterpriseSessionAllowed(env,{...session,operator}))throw new Error('Enterprise provider sign-in required')}
}}
