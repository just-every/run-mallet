import {runWebhooks} from '../src/mallet/webhook-door'
import {runReportSchedules} from '../src/mallet/reports/schedules'
import {expireIntakeSecrets} from '../src/mallet/intake-secrets'
import {salesReportResponse} from '../src/mallet/sales-report-door'
import {runRouting} from '../src/mallet/routing-door'
// The HTTP ownership chain used by the deployed Worker, without the unrelated
// TanStack asset entry. Mail is the only external boundary faked by the harness.
import {staticAssetResponse} from '../src/base/static-assets'
import { rejectedResponse } from '../src/base/rejected-response'
import { authResponse } from '../src/auth.server'
import { malletResponse } from '../src/mallet/http'
import { runApprovalChase } from '../src/mallet/approval-door'
export default {async fetch(request:Request,env:any,execution:ExecutionContext){const response=await staticAssetResponse(request,env)??await authResponse(request,env)??await salesReportResponse(request,env)??await malletResponse(request,env,execution)??new Response('Not found',{status:404});return rejectedResponse(request,response)},async scheduled(controller:ScheduledController,env:any){await runWebhooks(env,controller.scheduledTime);await runReportSchedules(env,controller.scheduledTime);await runApprovalChase(env,controller.scheduledTime);await runRouting(env,controller.scheduledTime);await expireIntakeSecrets(env,new Date(controller.scheduledTime).toISOString())}}
