import type {Bindings} from '../../auth.server'
import {operatorAuth,runtimeBindings} from '../../auth.server'
import {gateState} from './gate'
import {prove} from './store'

/** Only a newly issued native sign-in, never an existing cookie or bootstrap, confirms an unfactored person. */
export async function confirmFreshSignIn(request:Request,original:Bindings,response:Response){
 const path=new URL(request.url).pathname
 if(!/^\/auth\/(confirm|oidc\/[^/]+\/callback)$/.test(path)||!response.headers.has('set-cookie')||response.status>=400)return
 const env=runtimeBindings(original),cookie=response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ')
 const session=await operatorAuth(env).getSession(new Request(env.AUTH_ORIGIN+'/auth/session',{headers:{cookie}}))
 if(!session||session.kind==='dev')return
 const gate=await gateState(env,session,session.operator.id)
 if(!gate.enrolled&&!gate.required)await prove(env.DB,session.id,session.operator.id,'fresh-sign-in',true)
}
