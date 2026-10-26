import type {Bindings} from '../../auth.server'
import type {Authority} from '../auth'
import {digest} from '../auth'
import {configuredProviders} from './config'
// Every read repeats current employment and exact provider provenance; native cookies never bypass SSO.
export async function enterpriseSessionAllowed(env:Bindings,session:any):Promise<boolean>{
 if(!session)return false
 const user=await env.DB.prepare('SELECT * FROM mallet_enterprise_users WHERE id=?').bind(session.operator.id).first<any>()
 const pin=await env.DB.prepare('SELECT * FROM oa_provider_session_pins WHERE session_id=?').bind(session.id).first<any>()
 if(!user)return !pin?.provider_id?.startsWith('enterprise-')&&!await env.DB.prepare('SELECT 1 FROM mallet_saml_sessions WHERE session_id=?').bind(session.id).first()
 if(!user.active||session.operator.role!=='member'||session.kind!=='oidc')return false
 const connection=await env.DB.prepare("SELECT c.* FROM mallet_enterprise_connections c JOIN oa_operators o ON o.id=c.owner_id WHERE c.provider=? AND c.enabled=1 AND o.status='active' AND o.role='owner' AND o.version=c.owner_version").bind(user.provider).first<any>()
 const provider=configuredProviders(env).find(p=>p.id===user.provider)
 if(!connection||!provider||provider.issuer!==connection.issuer||provider.clientId!==connection.client_id||provider.protocol!==connection.protocol)return false
 if(provider.protocol==='oidc'){
  if(pin?.provider_id!==user.provider||pin.issuer!==connection.issuer||pin.client_id!==connection.client_id)return false
 }else{
  const cert=await digest(provider.certificate),saml=await env.DB.prepare('SELECT 1 FROM mallet_saml_sessions WHERE session_id=? AND provider=? AND issuer=? AND subject=? AND connection_revision=? AND certificate_hash=?').bind(session.id,user.provider,connection.issuer,user.external_id,connection.revision,cert).first()
  if(!saml||cert!==connection.certificate_hash)return false
 }
 return !!await env.DB.prepare('SELECT 1 FROM oa_provider_sessions WHERE session_id=? AND issuer=? AND subject=?').bind(session.id,connection.issuer,user.external_id).first()
}
export function enterpriseHooks(env:Bindings){return {
 beforeMagicLink:async({email}:any)=>!await env.DB.prepare('SELECT 1 FROM mallet_enterprise_users WHERE email=?').bind(email).first(),
 afterConfirm:async({session,operator}:any)=>{if(!await enterpriseSessionAllowed(env,{...session,operator}))throw new Error('Enterprise provider sign-in required')}
}}
export async function enterpriseAuthority(env:Bindings,operatorId:string,sessionId:string,base:Authority):Promise<Authority>{
 const user=await env.DB.prepare('SELECT 1 FROM mallet_enterprise_users WHERE id=?').bind(operatorId).first()
 if(!user)return base
 return {sql:`(${base.sql}) AND EXISTS(SELECT 1 FROM mallet_enterprise_users u JOIN mallet_enterprise_connections c ON c.provider=u.provider JOIN oa_operators owner ON owner.id=c.owner_id JOIN oa_provider_sessions s ON s.session_id=? WHERE u.id=? AND u.active=1 AND c.enabled=1 AND owner.status='active' AND owner.role='owner' AND owner.version=c.owner_version AND s.issuer=c.issuer AND s.subject=u.external_id AND ((c.protocol='oidc' AND EXISTS(SELECT 1 FROM oa_provider_session_pins p WHERE p.session_id=s.session_id AND p.provider_id=c.provider AND p.issuer=c.issuer AND p.client_id=c.client_id)) OR (c.protocol='saml' AND EXISTS(SELECT 1 FROM mallet_saml_sessions p WHERE p.session_id=s.session_id AND p.provider=c.provider AND p.issuer=c.issuer AND p.subject=u.external_id AND p.connection_revision=c.revision AND p.certificate_hash=c.certificate_hash))))`,params:[...base.params,sessionId,operatorId]}
}
