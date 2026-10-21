import {runtimeBindings,type Bindings} from '../auth.server'
import {identity,originGuard,human,HttpError} from './auth'
import {load,MalletError} from './model'
import {salesReport,salesReportCsv} from './reports/sales'
const headers={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}

/** Mounted before the general workshop handler in both deployed and test Workers. */
export async function salesReportResponse(request:Request,original:Bindings):Promise<Response|null> {
 const url=new URL(request.url)
 if(url.pathname!=='/api/mallet/reports/sales')return null
 try {
  const env=runtimeBindings(original)
  originGuard(request,env)
  const auth=await identity(request,env)
  // Same whole-shop native authority as the existing owner/admin state and report doors.
  if(!human(auth.actor))throw new HttpError(403,'manager_required')
  if(request.method!=='GET')throw new HttpError(405,'get_required')
  const format=url.searchParams.get('format')??'json'
  if(!['json','csv'].includes(format))throw new HttpError(400,'invalid_report_format')
  const report=salesReport(await load(env.DB),url.searchParams)
  return format==='csv'?new Response(salesReportCsv(report),{headers:{...headers,'content-type':'text/csv; charset=utf-8','content-disposition':`attachment; filename="mallet-sales-${report.period.from}-${report.period.to}.csv"`}}):Response.json(report,{headers})
 }catch(error){
  const known=error instanceof HttpError||error instanceof MalletError
  return Response.json({error:known?error.code:'operation_failed',message:known?error.message:'The report could not be prepared.'},{status:known?error.status:500,headers})
 }
}
