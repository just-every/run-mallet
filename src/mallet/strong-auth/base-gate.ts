// Base's own /auth routes (inviting people, changing roles, ending sessions) are reachable with a session cookie too.
// A cookie that still owes its second factor may sign in, sign out and read itself, and nothing else there.
import {gateState,blocked} from './gate'
import type {Bindings} from '../../auth.server'
const OPEN=/^\/auth\/(bootstrap|magic-link|confirm|signout|session$|owner-signin|owner-claim|review-session|dev\/|oidc\/|dependencies\/|setup-complete)/
export async function authGate(request:Request,env:Bindings,getSession:(request:Request)=>Promise<any>):Promise<Response|null>{
 const path=new URL(request.url).pathname
 if(!path.startsWith('/auth/')||OPEN.test(path))return null
 const session=await getSession(request).catch(()=>null)
 if(!session||!blocked(await gateState(env,session,session.operator.id)))return null
 return Response.json({error:'second_factor_required',message:'Confirm with your second factor first.'},{status:403,headers:{'cache-control':'no-store'}})
}
