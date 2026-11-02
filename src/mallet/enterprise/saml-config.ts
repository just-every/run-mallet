import type {Bindings} from '../../auth.server'
import type {SamlProvider} from './saml/index'
export type EnterpriseSaml=SamlProvider&{protocol:'saml';preset:'google'|'microsoft'|'okta';clientId:string}
export function configuredSaml(env:Bindings):EnterpriseSaml[]{
 if(!env.MALLET_ENTERPRISE_SAML)return []
 let items:any
 try{items=JSON.parse(env.MALLET_ENTERPRISE_SAML)}catch{throw Error('Invalid SAML configuration')}
 if(!Array.isArray(items)||items.length>3||new Set(items.map(p=>p.id)).size!==items.length)throw Error('Invalid SAML configuration')
 return items.map(p=>{
  if(!p||!/^enterprise-[a-z][a-z0-9-]{0,20}$/.test(p.id)||!['google','microsoft','okta'].includes(p.preset)||typeof p.issuer!=='string'||!p.issuer||p.issuer.length>1024||/[\x00-\x20\x7f]/.test(p.issuer)||typeof p.certificate!=='string'||p.certificate.length>16384||!p.certificate.includes('-----BEGIN CERTIFICATE-----'))throw Error('Invalid SAML configuration')
  const url=new URL(p.ssoUrl)
  if(url.protocol!=='https:'||url.username||url.password||url.hash||url.search)throw Error('Invalid SAML destination')
  const audience=env.AUTH_ORIGIN+'/auth/saml/'+p.id+'/metadata',acsUrl=env.AUTH_ORIGIN+'/auth/saml/'+p.id+'/acs'
  return {id:p.id,label:p.label??({google:'Google Workspace',microsoft:'Microsoft Entra ID',okta:'Okta'} as any)[p.preset]+' (SAML)',preset:p.preset,protocol:'saml',issuer:p.issuer,ssoUrl:url.href,certificate:p.certificate,audience,acsUrl,clientId:audience}
 })
}
