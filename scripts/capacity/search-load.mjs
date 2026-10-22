#!/usr/bin/env node
// Reduced OPS-002 search evidence only. Run after committing, outside Verify:
// node scripts/capacity/search-load.mjs --output /absolute/outside/repo/search.json
// The supervisor owns its child process group and enforces a hard deadline;
// credentials and arbitrary Worker/error output never reach stdout or artifacts.
import { fork, execFileSync } from 'node:child_process'
import { writeFile, realpath, rm } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {tmpdir} from 'node:os'
import { createHash } from 'node:crypto'

const filename=fileURLToPath(import.meta.url),root=resolve(dirname(filename),'../..')
const counts={shops:1,customers:30000,contacts:30000,vehicles:40000,repairOrders:1,photos:0,videos:0,stockedSkus:2500}
const gaps=['Incomplete OPS-002 dataset: one canceled RO, not 56,000 historical ROs per shop; no inspection/media/estimate/decision histories.','One shop only; ten-shop identity/isolation and 300 native staff sessions are unsupported.','No 50 open customer links, board/RO/photo measurements, restart or provider-job timing is exercised.','Plate/VIN queries share the native opaque asset.identifier field; generated identifiers prove neither manufacturer identity nor VIN decoding.','Local Miniflare/D1 evidence does not establish deployed Cloudflare/D1 performance.']
function fail(code){const error=new Error(code);error.publicCode=code;throw error}
function git(...args){return execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim()}
const p95=values=>values.length?[...values].sort((a,b)=>a-b)[Math.ceil(values.length*.95)-1]:null
const summary=values=>({samples:values.length,p95Ms:p95(values),maxMs:values.length?Math.max(...values):null})
const within=(base,path)=>{const rel=relative(base,path);return rel===''||!rel.startsWith('..'+(process.platform==='win32'?'\\':'/'))&&!isAbsolute(rel)&&rel!=='..'}

async function workload(config){
 const {installation}=await import('../../tests/harness.mjs')
 const {readEmptyTemplate,capacityArchive}=await import('./archive.mjs')
 const {importCapacity}=await import('./import.mjs')
 const {searchIdentifier,syntheticId}=await import('./dataset.mjs')
 const owned=new Set();let cancelled=false,phase='bootstrap',completedParts=0,cleanupPromise
 const cleanup=()=>cleanupPromise??=(async()=>{const all=[...owned];owned.clear();return (await Promise.allSettled(all.map(h=>h.close()))).every(r=>r.status==='fulfilled')})()
 const check=()=>{if(cancelled)fail('cancelled');if(Date.now()>config.deadline)fail('deadline_exceeded')}
 process.once('SIGTERM',()=>{cancelled=true;void cleanup()})
 const install=async()=>{check();const h=await installation({onScratch:path=>process.send?.({type:'resource',path})});if(cancelled){await h.close();fail('cancelled')}owned.add(h);check();return h}
 try{
  const source=await install()
  phase='empty_native_export'
  const exported=await source.api('/api/portability/exports',{},{status:201})
  let exportState
  do{check();exportState=await source.api(`/api/portability/exports/${exported.id}/advance`,{})}while(exportState.phase!=='complete')
  const download=await source.request(`/api/portability/exports/${exported.id}/download`)
  if(download.status!==200||!download.body)fail('empty_export_download')
  const template=await readEmptyTemplate(download.body)
  await source.close();owned.delete(source)
  phase='bounded_archive_planning'
  const fixture=await capacityArchive(template,{scale:'single-shop',identifierFormat:'plate-and-vin',customers:counts.customers,vehicles:counts.vehicles,repairOrders:1,photosPerRepairOrder:0,videosPerRepairOrder:0,stockedSkus:counts.stockedSkus})
  check()
  const target=await install()
  phase='streamed_native_import'
  const imported=await importCapacity(fixture.lines(),async(path,options)=>{check();return target.request(path,options)},{onProgress:progress=>{completedParts=progress.completed;phase=progress.phase==='finalizing'?'native_finalize':'streamed_native_import';if(completedParts%250===0||progress.phase==='finalizing')process.send?.({type:'progress',phase,completedParts});check()}})
  if(imported.phase!=='complete')fail('native_import_incomplete')
  phase='native_admin_invite_confirm'
  const sessions=[]
  for(let n=1;n<=30;n++){
   check();const person=await target.person(`synthetic-search-load-${n}@example.test`,'admin')
   if(person.session.kind!=='native'||person.session.operator.role!=='admin'||typeof person.session.id!=='string')fail('native_session_required')
   sessions.push(person)
  }
  const ids=sessions.map(s=>s.session.id)
  if(new Set(ids).size!==30||new Set(sessions.map(s=>s.id)).size!==30)fail('distinct_native_sessions_required')
  phase='thirty_concurrent_search_sessions'
  const groups={name:[],phone:[],plate:[],vin:[]},client=[],all=[],logStart=target.logs.length
  const expectedSamples=30*4*config.rounds
  // Every round is a 30-client barrier. Each session has at most one request
  // in flight; all rounds/groups, including cold requests, are measured.
  for(let round=0;round<config.rounds;round++)for(const group of Object.keys(groups)){
   await Promise.all(sessions.map(async(session,index)=>{
    check()
    const customer=(index*997+round*37)%counts.customers+1,vehicle=(index*2+round*1994)%counts.vehicles+1+(group==='vin'?1:0)
    const query=group==='name'?`Synthetic capacity customer ${customer}`:group==='phone'?`1202555${String(customer).padStart(6,'0')}`:searchIdentifier(vehicle)
    const expected=syntheticId('account',group==='name'||group==='phone'?customer:(vehicle-1)%counts.customers+1)
    const start=performance.now(),response=await target.request('/api/mallet/accounts?'+new URLSearchParams({q:query}),{as:session.cookie})
    if(response.status!==200){await response.body?.cancel();fail('search_http_'+response.status)}
    const match=/(?:^|,)\s*mallet\s*;\s*dur=([0-9]+(?:\.[0-9]+)?)/i.exec(response.headers.get('server-timing')??'')
    if(!match||!Number.isFinite(Number(match[1])))fail('server_timing_required')
    const result=await response.json()
    if(!Array.isArray(result.accounts)||result.accounts.length>50||!result.accounts.some(a=>a.id===expected))fail('native_first_page_result_invalid')
    groups[group].push(Number(match[1]));all.push(Number(match[1]));client.push(performance.now()-start)
   }))
  }
  const requestLogs=()=>target.logs.slice(logStart).flatMap(line=>{try{const item=JSON.parse(line);return item.event==='mallet_request'&&item.route==='account-search'&&item.method==='GET'&&item.status===200&&Number.isFinite(item.durationMs)&&item.durationMs>=0?[item.durationMs]:[]}catch{return[]}})
  // Structured Worker log delivery can trail the response; wait at most 2 s.
  let logged=requestLogs(),waited=0
  while(logged.length<expectedSamples&&waited<2000){check();await new Promise(r=>setTimeout(r,25));waited+=25;logged=requestLogs()}
  if(logged.length!==expectedSamples||all.length!==expectedSamples)fail('captured_worker_timing_count_mismatch')
  const report={kind:'mallet-reduced-search-load',gitHead:config.gitHead,node:process.versions.node,incomplete:true,completed:true,gaps,dataset:{...counts,identifierFormat:'plate-and-vin',syntheticPlateIdentifiers:20000,syntheticVinIdentifiers:20000,nativeArchiveRows:fixture.manifest.tables.reduce((n,t)=>n+t.count,0),nativeArchiveParts:fixture.manifest.partCount,completedNativeParts:completedParts},sessions:{concurrent:30,role:'admin',authentication:'native invite/email confirmation',uniqueNativeSessionIds:new Set(ids).size,uniqueOperatorIds:new Set(sessions.map(s=>s.id)).size,sessionIdSetSha256:createHash('sha256').update([...ids].sort().join('\n')).digest('hex')},measurement:{rounds:config.rounds,expectedSamples,firstPageLimit:50,includesColdRequests:true,queryGroups:'name, phone, plate/VIN-in-native-identifier',serverTiming:summary(all),workerRequestLogs:summary(logged),perQueryGroup:Object.fromEntries(Object.entries(groups).map(([group,values])=>[group,summary(values)])),clientWallClockForContextOnly:summary(client),serverP95Within500Ms:p95(all)<=500&&p95(logged)<=500},elapsedMs:Date.now()-config.started}
  report.cleanupCompleted=await cleanup()
  return report
 }catch(error){const cleanupCompleted=await cleanup();return {kind:'mallet-reduced-search-load',gitHead:config.gitHead,incomplete:true,completed:false,dataset:counts,gaps,phase,error:cancelled?'cancelled':error.publicCode??error.code??error.name??'workload_failed',completedNativeParts:completedParts,cleanupCompleted,elapsedMs:Date.now()-config.started}}
}

async function main(){
 if(process.argv[2]==='--worker'){
  const report=await workload(JSON.parse(process.argv[3]));process.send?.(report);process.disconnect?.();process.exitCode=report.completed&&report.cleanupCompleted?0:1;return
 }
 const options={rounds:5,timeoutMs:900000,output:null}
 for(let i=2;i<process.argv.length;i+=2){const flag=process.argv[i],value=process.argv[i+1];if(flag==='--help'){process.stdout.write('node scripts/capacity/search-load.mjs [--output /outside/repo/result.json] [--rounds 5] [--timeout-ms 900000]\nIncomplete OPS-002 search workload: 30 native sessions, 30k customers, 40k vehicles, 1 canceled RO, no media.\n');return}if(value===undefined||!['--output','--rounds','--timeout-ms'].includes(flag))fail('invalid_arguments');options[flag==='--timeout-ms'?'timeoutMs':flag.slice(2)]=flag==='--output'?value:Number(value)}
 if(!Number.isInteger(options.rounds)||options.rounds<1||options.rounds>20||!Number.isInteger(options.timeoutMs)||options.timeoutMs<60000||options.timeoutMs>3600000)fail('invalid_workload_bound')
 const gitHead=git('rev-parse','HEAD')
 if(!/^[a-f0-9]{40}$/.test(gitHead)||git('status','--porcelain','--untracked-files=normal'))fail('commit_clean_tree_before_running')
 if(options.output){options.output=resolve(options.output);const directory=await realpath(dirname(options.output));if(within(await realpath(root),directory))fail('output_must_be_outside_repository');options.output=resolve(directory,options.output.split(/[\\/]/).at(-1))}
 const config={...options,gitHead,started:Date.now()};config.deadline=config.started+options.timeoutMs
 const child=fork(filename,['--worker',JSON.stringify(config)],{cwd:root,detached:process.platform!=='win32',execArgv:[],stdio:['ignore','ignore','ignore','ipc']})
 let result,cancelled=false,hardKill,timer;const resources=new Set();let progress={phase:'bootstrap',completedParts:0}
 const stop=()=>{if(cancelled)return;cancelled=true;child.kill('SIGTERM');hardKill=setTimeout(()=>{try{if(process.platform==='win32')child.kill('SIGKILL');else process.kill(-child.pid,'SIGKILL')}catch{}},5000)}
 const interrupt=()=>stop();process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt)
 await new Promise(resolveDone=>{
  timer=setTimeout(stop,options.timeoutMs)
  child.on('message',message=>{if(message?.type==='resource'){const path=resolve(message.path);if(dirname(path)===resolve(tmpdir())&&path.split(/[\\/]/).at(-1).startsWith('mallet-api-'))resources.add(path)}else if(message?.type==='progress'){progress={phase:message.phase,completedParts:message.completedParts};process.stdout.write(JSON.stringify(progress)+'\n')}else result=message})
  child.once('error',()=>resolveDone())
  child.once('exit',()=>resolveDone())
 })
 clearTimeout(timer);clearTimeout(hardKill);process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt)
 if(cancelled||!result)result={kind:'mallet-reduced-search-load',gitHead,incomplete:true,completed:false,dataset:counts,gaps,error:cancelled?'deadline_or_interrupt':'worker_exited_without_result',cleanupCompleted:result?.cleanupCompleted??false,...progress,elapsedMs:Date.now()-config.started}
 if(!result.cleanupCompleted){
  // The detached group and scratch directories were recorded from this child.
  // A failed workload remains failed even after its resources are removed.
  // The child has exited. Never signal its old group here: its numeric ID may
  // have been reused. Verify absence before claiming its resources are gone.
  let groupAbsent=false
  try{if(process.platform!=='win32')groupAbsent=!execFileSync('ps',['-axo','pgid='],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim().split(/\s+/).some(id=>Number(id)===child.pid)}catch{}
  const cleaned=await Promise.allSettled([...resources].map(path=>rm(path,{recursive:true,force:true})))
  result.scratchCleanupCompleted=resources.size>0&&cleaned.every(r=>r.status==='fulfilled')
  result.processGroupAbsent=groupAbsent
  result.cleanupCompleted=groupAbsent&&result.scratchCleanupCompleted
 }
 const serialized=JSON.stringify(result,null,2)+'\n'
 if(options.output)await writeFile(options.output,serialized,{flag:'wx',mode:0o600})
 process.stdout.write(serialized);if(!result.completed||!result.cleanupCompleted)process.exitCode=1
}
main().catch(error=>{process.stderr.write(JSON.stringify({incomplete:true,completed:false,error:error.publicCode??error.code??error.name??'workload_configuration_failed'})+'\n');process.exitCode=1})
