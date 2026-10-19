import {Miniflare,convertV4MiniflareOptions} from 'miniflare'
import {unstable_splitSqlQuery} from 'wrangler'
import {build} from 'esbuild'
import {execFileSync} from 'node:child_process'
import {mkdtemp,mkdir,readFile,readdir,rm} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {randomBytes,randomUUID} from 'node:crypto'
import assert from 'node:assert/strict'

// Execute the real, unmodified public Pier source, with its own database and
// native auth. Only the mail-provider network edge is controlled by this test.
// Pin the source so a later Pier change cannot silently alter this acceptance.
const revision='2e765586f301a4b9ea1710aaa5a1bf3d4ea3be5b'
export async function realPier() {
 await mkdir('.cache',{recursive:true})
 const root=await mkdtemp(resolve('.cache/pier-journey-')),source=join(root,'source'),messages=[]
 let mf
 try {
  execFileSync('git',['clone','--quiet','--filter=blob:none','--no-checkout','https://github.com/just-every/run-pier',source],{stdio:'pipe'})
  execFileSync('git',['-C',source,'checkout','--quiet',revision],{stdio:'pipe'})
  const bundled=await build({entryPoints:[join(source,'tests/api/worker.ts')],bundle:true,write:false,format:'esm',platform:'neutral',target:'es2022',external:['node:*','cloudflare:*'],loader:{'.css':'text','.svg':'text'},nodePaths:[resolve('node_modules')]})
  const setup=randomBytes(32).toString('hex'),secret=randomBytes(32).toString('hex')
  let origin='https://127.0.0.1'
  const options=()=>({...convertV4MiniflareOptions({host:'127.0.0.1',port:Number(new URL(origin).port),modules:true,script:bundled.outputFiles[0].text,compatibilityDate:'2026-09-08',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{AUTH_ORIGIN:origin,OWNER_EMAIL:'owner@example.test',SESSION_SECRET:secret,SETUP_TOKEN:setup,MAIL_PROVIDER:'resend',MAIL_API_KEY:'test-pier-mail-edge',MAIL_FROM:'auth@example.test'},outboundService:async request=>{assert.equal(new URL(request.url).hostname,'api.resend.com');messages.push(await request.json());return Response.json({id:randomUUID()})}}),resourcePersistencePath:join(root,'data')})
  mf=new Miniflare(options());origin='https://'+(await mf.ready).host;await mf.setOptions(options());await mf.ready
  const db=await mf.getD1Database('DB')
  for(const file of (await readdir(join(source,'migrations/core'))).filter(f=>f.endsWith('.sql')).sort())await db.batch(unstable_splitSqlQuery(await readFile(join(source,'migrations/core',file),'utf8')).map(sql=>db.prepare(sql)))
  let owner=''
  const request=(path,{method='GET',body,as=owner}={})=>mf.dispatchFetch(origin+path,{method,redirect:'manual',headers:{origin,host:new URL(origin).host,'content-type':'application/json',...(as?{cookie:as}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})})
  const cookies=response=>response.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')
  const boot=await request('/auth/bootstrap',{method:'POST',body:{token:setup,displayName:'Buckeye inventory owner'}})
  assert.equal(boot.status,303);owner=cookies(boot);assert.ok(owner)
  const state=async()=>{const response=await request('/api/pier/state');assert.equal(response.status,200);return response.json()}
  const command=async(type,payload)=>{const response=await request('/api/pier/commands',{method:'POST',body:{commandId:randomUUID(),type,payload}}),body=await response.json();assert.equal(response.status,200,JSON.stringify(body));assert.equal(body.ok,true,JSON.stringify(body));return body.result}
  const session=async()=>{
   const sent=await request('/auth/magic-link',{method:'POST',as:'',body:{email:'owner@example.test',returnTo:'/app'}});assert.equal(sent.status,202)
   const link=messages.at(-1)?.text.match(/https?:\/\/[^\s<>]+\/auth\/confirm\?token=[^\s<>]+/);assert.ok(link,'Native sign-in mail reached the controlled mail edge')
   const confirmed=await request('/auth/confirm',{method:'POST',as:'',body:{token:new URL(link[0]).searchParams.get('token')}});assert.equal(confirmed.status,303)
   return cookies(confirmed)
  }
  return {origin,owner,request,command,state,session,fetch:request=>mf.dispatchFetch(request.url,{method:request.method,headers:request.headers,redirect:'manual'}),async close(){await mf.dispose();await rm(root,{recursive:true,force:true})}}
 }catch(error){await mf?.dispose();await rm(root,{recursive:true,force:true});throw error}
}
