// The HTTP ownership chain used by the deployed Worker, without the unrelated
// TanStack asset entry. Mail is the only external boundary faked by the harness.
import { rejectedResponse } from '../src/base/rejected-response'
import { authResponse } from '../src/auth.server'
import { malletResponse } from '../src/mallet/http'
export default {async fetch(request:Request,env:any){const response=await authResponse(request,env)??await malletResponse(request,env)??new Response('Not found',{status:404});return rejectedResponse(request,response)}}
