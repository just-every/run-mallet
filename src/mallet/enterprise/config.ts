import type {Bindings} from '../../auth.server'
import type {IdentityProviderConfig} from '../../modules/operator-auth/index.mjs'
export type EnterpriseProvider=IdentityProviderConfig&{id:string;preset:'google'|'microsoft'|'okta';issuer:string;label:string}
export function configuredProviders(env:Bindings):EnterpriseProvider[]{
 if(!env.MALLET_ENTERPRISE_OIDC)return []
 let values:any
 try{values=JSON.parse(env.MALLET_ENTERPRISE_OIDC)}catch{throw new Error('Invalid enterprise provider configuration')}
 if(!Array.isArray(values)||values.length>3||new Set(values.map(p=>p.id)).size!==values.length)throw new Error('Invalid enterprise provider configuration')
 return values.map(p=>{
  if(!p||!['google','microsoft','okta'].includes(p.preset)||!/^enterprise-[a-z][a-z0-9-]{0,20}$/.test(p.id)||p.redirectUri!==undefined||p.subjectEmails!==undefined||p.endpointOrigins!==undefined)throw new Error('Invalid enterprise provider configuration')
  const issuer=p.preset==='google'?'https://accounts.google.com':p.preset==='microsoft'?`https://login.microsoftonline.com/${p.tenant}/v2.0`:p.issuer
  const url=new URL(issuer)
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new Error('Invalid enterprise issuer')
  return {...p,issuer,label:p.label??({google:'Google Workspace',microsoft:'Microsoft Entra ID',okta:'Okta'} as any)[p.preset]}
 })
}
export async function enterpriseProviders(env:Bindings){
 const configured=configuredProviders(env)
 if(!configured.length)return []
 const connections=(await env.DB.prepare('SELECT provider,issuer,client_id FROM mallet_enterprise_connections WHERE enabled=1').all<any>()).results
 const users=(await env.DB.prepare('SELECT provider,external_id,email FROM mallet_enterprise_users WHERE active=1').all<any>()).results
 return configured.filter(p=>connections.some(c=>c.provider===p.id&&c.issuer===p.issuer&&c.client_id===p.clientId)).map(p=>({...p,subjectEmails:Object.fromEntries(users.filter(u=>u.provider===p.id).map(u=>[u.external_id,u.email]))}))
}
