import {box,e,field,hidden} from './common'

type Provider={id:string;label:string;preset:string;issuer:string}
type Connection={provider:string;enabled:number;revision:number}
type ProvisionedUser={id:string;provider:string;external_id:string;email:string;display_name:string;active:number;role:string;location:string}
type View={providers:Provider[];connections:Connection[];users:ProvisionedUser[];notice?:string}

const consent=(label:string)=>`<label><input type="checkbox" name="consent" value="yes" required> ${e(label)}</label>`

function action(provider:string,kind:'enable'|'rotate'|'revoke'){
 const enable=kind==='enable',revoke=kind==='revoke'
 const button=enable?'Enable provisioning':revoke?'Revoke provisioning':'Rotate SCIM token'
 const explanation=enable
  ?'I authorize this provider to provision technicians in this shop only.'
  :revoke?'I authorize revoking this provider’s provisioning authority.'
  :'I authorize replacing this provider’s SCIM token; the previous token will stop working.'
 return `<form method="post" action="/app/enterprise/${kind}">${hidden('provider',provider)}${enable?field('Assigned role','role','text','technician','readonly')+field('Location (this shop)','location','text','shop','readonly'):''}${field('Reason for this change','reason','text','','required maxlength="500"')}${consent(explanation)}<button>${button}</button></form>`
}

function providerCard(provider:Provider,connection:Connection|undefined){
 const enabled=connection?.enabled===1
 const state=enabled?'Provisioning enabled':connection?'Provisioning revoked':'Provisioning not enabled'
 const setup=`<details><summary>Provider setup reference</summary><dl><dt>Provider ID</dt><dd>${e(provider.id)}</dd><dt>Configuration preset</dt><dd>${e(provider.preset)}</dd><dt>OIDC issuer</dt><dd>${e(provider.issuer)}</dd><dt>SCIM base endpoint</dt><dd><code>${e('/scim/v2/'+encodeURIComponent(provider.id))}</code></dd></dl><p>Use this shop’s origin with the endpoint above. Sign-in uses the configured OIDC provider; SCIM manages provisioned users.</p><p><a href="/connectors">Read the published connection declarations</a></p></details>`
 const controls=enabled
  ?`<details><summary>Manage provisioning</summary><h3>Replace the token</h3><p>Update the provider with the new token after rotating. The previous token stops working immediately.</p>${action(provider.id,'rotate')}<h3>Revoke provisioning</h3><p>The provider’s token stops working and all its provisioned technicians lose access. Existing repair attribution is retained.</p>${action(provider.id,'revoke')}</details>`
  :action(provider.id,'enable')
 return box(provider.label,`<p>${state}${connection?` · revision ${e(connection.revision)}`:''}</p>${setup}${controls}`)
}

function userList(view:View){
 if(!view.users.length)return '<p>No provisioned users yet. Users sent by an enabled provider will appear here.</p>'
 const providers=new Map(view.providers.map(provider=>[provider.id,provider.label]))
 return `<ul class="list">${view.users.map(user=>`<li class="plain"><span class="row-name">${e(user.display_name||user.email||user.external_id)}</span><span class="row-meta">${e(providers.get(user.provider)??user.provider)} · ${user.active===1?'Active':'Deactivated'}</span><details><summary>Provisioned identity</summary><dl><dt>Email</dt><dd>${e(user.email||'Not supplied')}</dd><dt>External ID</dt><dd>${e(user.external_id)}</dd><dt>Assigned role</dt><dd>${e(user.role==='technician'?'Technician':user.role)}</dd><dt>Location</dt><dd>${e(user.location==='shop'?'This shop':user.location)}</dd></dl></details></li>`).join('')}</ul>`
}

export function enterprisePage(view:View,token?:string){
 const notice=view.notice?`<p class="notice" role="status">${e(view.notice)}</p>`:''
 const issuedToken=token?box('Save your new SCIM token',`<p>This token is shown only now. Store it securely in the provider you just enabled or rotated.</p>${field('New SCIM bearer token','scimToken','text',token,'readonly autocomplete="off" spellcheck="false"')}<p>If it is lost, rotate the token to issue a replacement.</p>`):''
 const providers=view.providers.length
  ?view.providers.map(provider=>providerCard(provider,view.connections.find(connection=>connection.provider===provider.id))).join('')
  :box('Configure an identity provider',`<p>No enterprise identity providers are configured for this shop. Add a provider in the deployment settings before enabling provisioning here.</p><p><a href="/connectors">Read the connection setup declarations</a></p>`)
 const reference=box('Access rules',`<details><summary>How enterprise access works</summary><p>Only the owner can enable, rotate or revoke provisioning. The owner must enroll a second factor and confirm it freshly before making changes. <a href="/app/security">Manage your second factors</a>.</p><p>Provisioned users are assigned the technician role in this shop. Roles are never inferred from email addresses or domains. Provisioning cannot create owners or grant administrator access.</p><p>Deactivating a provisioned user ends their sessions and integration authority. Their attribution on existing shop records is retained.</p></details>`)
 return `<div class="narrow"><p><a class="back" href="/app/security">← Back to security settings</a></p><p class="lede">Manage enterprise sign-in and technician provisioning for this shop.</p>${notice}${issuedToken}<div class="stack">${providers}${box('Provisioned users',userList(view))}${reference}</div></div>`
}
