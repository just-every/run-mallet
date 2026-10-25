import assert from 'node:assert/strict'
// Local mail is suppressed; invited test people enter through the native development sign-in door.
export const localPeople=h=>async(email,role='member')=>{
 await h.api('/auth/invite',{email,role,displayName:email.split('@')[0],returnTo:'/app'},{status:202})
 const entered=await h.request('/auth/one-click?as='+encodeURIComponent(email));assert.equal(entered.status,303)
 const cookies=new Map(h.owner.split('; ').map(pair=>[pair.slice(0,pair.indexOf('=')),pair.slice(pair.indexOf('=')+1)]))
 for(const value of entered.headers.getSetCookie()){const pair=value.split(';')[0],at=pair.indexOf('=');cookies.set(pair.slice(0,at),pair.slice(at+1))}
 const cookie=[...cookies].map(([name,value])=>name+'='+value).join('; '),session=await h.api('/auth/session',undefined,{as:cookie})
 return {id:session.operator.id,cookie,session}
}
