import {bump,choice,event,expectVersion,fail,find,integer,put,text,who,type Context,type Handler} from './model'

export const rateProfileCommands=['rateProfile.save'] as const
export type RateProfileRevision={n:number;name:string;kind:'customer'|'fleet';laborRateCents:number;reason:string;at:string;by:ReturnType<typeof who>}
export type RateProfileSnapshot={id:string;version:number;revision:number;snapshot:RateProfileRevision}

export const rateProfiles:Handler=(c,command,p)=>{
 if(command!=='rateProfile.save')return
 if(!['owner','admin'].includes(c.actor.role))fail('FORBIDDEN','Only an owner or service advisor may configure rate profiles.',null,403)
 const existing=p.id===undefined?null:find(c.s,'rateProfile',p.id)
 if(existing)expectVersion(existing,p.version)
 else if(integer(p.version,'version',0)!==0)fail('VERSION','New rate profiles require version zero.')
 const revision:RateProfileRevision={n:existing?existing.revisions.at(-1).n+1:1,name:text(p.name,'profile name'),kind:choice(p.kind,['customer','fleet'] as const,'profile kind'),laborRateCents:integer(p.laborRateCents,'laborRateCents'),reason:text(p.reason,'revision reason',2000),at:c.now,by:who(c)}
 const saved=existing?bump(c.s,'rateProfile',existing,{revisions:[...existing.revisions,revision]}):put(c.s,'rateProfile',{createdAt:c.now,revisions:[revision]})
 event(c,command,null,saved.id,revision)
 return saved
}

/** An explicit pricing choice, never a customer identity or fleet membership match. */
export function resolveRateProfile(c:Context,p:{rateProfileId?:unknown;rateProfileVersion?:unknown}):RateProfileSnapshot|null {
 if(p.rateProfileId===undefined){
  if(p.rateProfileVersion!==undefined)fail('INPUT','Choose a rate profile with its version.',null,400)
  return null
 }
 const profile=find(c.s,'rateProfile',p.rateProfileId)
 expectVersion(profile,p.rateProfileVersion)
 const revision=profile.revisions.at(-1) as RateProfileRevision
 return {id:profile.id,version:profile.version,revision:revision.n,snapshot:structuredClone(revision)}
}
