import {Miniflare,convertV4MiniflareOptions} from 'miniflare'
import {unstable_splitSqlQuery} from 'wrangler'
import {build} from 'esbuild'
import {execFileSync} from 'node:child_process'
import {mkdtemp,mkdir,readFile,readdir,rm,access,open,rename} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {randomBytes,randomUUID} from 'node:crypto'
import assert from 'node:assert/strict'
export const crankRevision='7203b25315b47b962f1db06d2837dcb5e88468ef'
/** An immutable public-source read through GitHub's API; no neighbouring checkout or branch is mutated. */
export async function realCrank(){
 await mkdir('.cache',{recursive:true});const cache=resolve('.cache/crank-'+crankRevision+'.tgz')
 try{await access(cache)}catch{
  // Stream the pinned archive to disk; only bounded diagnostics enter memory.
  // Publish a complete download atomically so an interrupted fetch cannot poison the cache.
  const partial=cache+'.'+randomUUID()+'.partial',output=await open(partial,'wx',0o600)
  try{
   try{execFileSync('gh',['api','repos/just-every/run-crank/tarball/'+crankRevision],{timeout:120000,maxBuffer:64*1024,stdio:['ignore',output.fd,'pipe']})}
   finally{await output.close()}
   await rename(partial,cache)
  }finally{await rm(partial,{force:true})}
 }
 const root=await mkdtemp(resolve('.cache/crank-proof-'));let mf
 try{
  execFileSync('tar',['-xzf',cache,'-C',root,'--strip-components=1'])
  const bundle=await build({entryPoints:[join(root,'tests/worker.ts')],bundle:true,write:false,format:'esm',platform:'neutral',target:'es2023',conditions:['workerd','worker','browser'],external:['node:*','cloudflare:*'],nodePaths:[resolve('node_modules')]})
  const secret=randomBytes(32).toString('hex'),setup=randomBytes(32).toString('hex');let origin='https://127.0.0.1'
  const options=()=>({...convertV4MiniflareOptions({host:'127.0.0.1',port:0,modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-09-08',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{AUTH_ORIGIN:origin,OWNER_EMAIL:'owner@example.test',SESSION_SECRET:secret,SETUP_TOKEN:setup,MAIL_PROVIDER:'resend',MAIL_API_KEY:'synthetic-mallet-mail',MAIL_FROM:'auth@example.test'},outboundService:()=>Response.json({id:randomUUID()})}),resourcePersistencePath:join(root,'data')})
  mf=new Miniflare(options());origin='https://'+(await mf.ready).host;await mf.setOptions(options());await mf.ready
  const db=await mf.getD1Database('DB');for(const file of (await readdir(join(root,'./migrations/core'))).filter(f=>f.endsWith('.sql')).sort())await db.batch(unstable_splitSqlQuery(await readFile(join(root,'./migrations/core',file),'utf8')).map(sql=>db.prepare(sql)))
  let owner='';const request=(path,body)=>mf.dispatchFetch(origin+path,{redirect:'manual',method:body===undefined?'GET':'POST',headers:{host:new URL(origin).host,origin,'content-type':'application/json',cookie:owner},...(body===undefined?{}:{body:JSON.stringify(body)})})
  const boot=await request('/auth/bootstrap',{token:setup,displayName:'Synthetic Mallet consumer owner'});assert.equal(boot.status,303,await boot.text());owner=boot.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ')
  const api=async(path,body,status=200)=>{const response=await request('/api/crank/'+path,body),value=await response.json();assert.equal(response.status,status,JSON.stringify(value));return value}
  return {api,async deliver(path,request){return mf.dispatchFetch(origin+new URL(path).pathname,{method:'POST',headers:request.headers,body:await request.arrayBuffer()})},async close(){await mf.dispose();await rm(root,{recursive:true,force:true})}}
 }catch(error){await mf?.dispose();await rm(root,{recursive:true,force:true});throw error}
}
