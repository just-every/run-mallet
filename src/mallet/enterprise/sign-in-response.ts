import {page} from '../ui/shell'
import {e} from '../ui/common'

export async function enterpriseSignInResponse(request:Request,response:Response,getSession:(request:Request)=>Promise<any>){
 const url=new URL(request.url),location=response.headers.get('location')
 if(!/^\/auth\/(?:oidc\/enterprise-[^/]+\/callback|saml\/enterprise-[^/]+\/acs)$/.test(url.pathname)||response.status!==303||!request.headers.get('accept')?.includes('text/html')||!location?.startsWith('/')||location.startsWith('//')||/[\\\u0000-\u0020]/.test(location))return response
 const issued=response.headers.getSetCookie()
 if(!issued.length||!await getSession(new Request(url.origin+'/auth/session',{headers:{cookie:issued.map(value=>value.split(';')[0]).join('; ')}})))return response
 // Finish the external navigation here. The explicit local navigation retains
 // the app's existing refusal of requests carrying a cross-site fetch context.
 const continued=await page('Continue to Mallet',`<section class="card"><p>Your identity provider has confirmed this sign-in. Continue to your workshop.</p><p><a class="button primary" href="${e(location)}">Continue to workshop</a></p></section>`)
 for(const cookie of issued)continued.headers.append('set-cookie',cookie)
 return continued
}
