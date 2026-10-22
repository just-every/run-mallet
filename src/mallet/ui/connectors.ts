import {e,box,field,form,when} from './common'
import {CONNECTORS,type Declaration} from '../connectors/registry'
const list=(items:string[])=>`<ul>${items.map(x=>`<li>${e(x)}</li>`).join('')}</ul>`
const declaration=(c:Declaration)=>`<h3>${e(c.name)} <span class="row-meta">declaration version ${c.version}</span></h3><p>${e(c.purpose)}</p><h4>What Mallet sends</h4>${list(c.sends)}<h4>What comes back</h4>${list(c.receives)}<h4>Retention</h4><p>${e(c.retention)}</p><h4>Licence and access</h4><p>${e(c.licensing)}</p><p>${e(c.access)}</p>`
/** Published to everyone before any connector is enabled. */
export const publishedConnectors=()=>`<div class="narrow"><p class="lede">Every outside service Mallet can talk to, what crosses the line in each direction, what is kept and under whose terms. Nothing is enabled until the owner reads its declaration and saves its credential.</p>${CONNECTORS.map(c=>box(c.name,declaration(c))).join('')}</div>`
export function connectorsPage(actor:{role:string},status:Record<string,any>){
 const owner=actor.role==='owner'
 return `<div class="narrow"><p class="lede">Credentials are sealed when saved and never shown again; only a short fingerprint tells you which one is in use. Saving a new one replaces the old for good. Read the <a href="/connectors">published declarations</a> first.</p>${CONNECTORS.map(c=>box(c.name,declaration(c)+c.secrets.map(s=>{
  const row=status[c.id+':'+s.name],state=row?row.status==='active'?`Saved version ${row.version}, fingerprint <code>${e(row.fingerprint)}</code>, ${when(new Date(row.changedAt).toISOString())}`:`Revoked (version ${row.version}); nothing uses it`:'From your deployment’s own settings'
  return `<h4>${e(s.label)}</h4><p>${state}</p>${owner&&s.rotatable?form('connector.save',field('New credential','credential','password','','required autocomplete="off" maxlength="4096"')+`<label><input type="checkbox" name="acknowledge" value="${c.version}" required> I have read the ${e(c.name)} declaration above</label>`,row?.status==='active'?'Rotate credential':'Save credential',{connector:c.id,name:s.name})+(row?.status==='active'||!row?form('connector.revoke','','Revoke',{connector:c.id,name:s.name}):''):''}`
 }).join(''))).join('')}</div>`
}
