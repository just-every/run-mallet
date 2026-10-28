import {runMalletScheduled} from '../src/mallet/scheduled'
import {salesReportResponse} from '../src/mallet/sales-report-door'
// The HTTP ownership chain used by the deployed Worker, without the unrelated
// TanStack asset entry. Mail is the only external boundary faked by the harness.
import {staticAssetResponse} from '../src/base/static-assets'
import { rejectedResponse } from '../src/base/rejected-response'
import { authResponse } from '../src/auth.server'
import { malletResponse } from '../src/mallet/http'
export default {async fetch(request:Request,env:any,execution:ExecutionContext){const response=await staticAssetResponse(request,env)??await authResponse(request,env)??await salesReportResponse(request,env)??await malletResponse(request,env,execution)??new Response('Not found',{status:404});return rejectedResponse(request,response)},async scheduled(controller:ScheduledController,env:any){await runMalletScheduled(env,controller.scheduledTime)}}
