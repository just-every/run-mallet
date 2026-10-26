import {createServer} from 'node:https'
import {execFileSync} from 'node:child_process'
import {mkdtempSync,readFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

export async function providerHttps(render){
 const scratch=mkdtempSync(join(tmpdir(),'synthetic-mallet-provider-'));let key,cert
 try{
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-sha256','-days','2','-subj','/CN=synthetic-mallet-provider','-keyout',join(scratch,'key.pem'),'-out',join(scratch,'cert.pem')],{stdio:'pipe'})
  key=readFileSync(join(scratch,'key.pem'));cert=readFileSync(join(scratch,'cert.pem'))
 }finally{rmSync(scratch,{recursive:true,force:true})}
 const server=createServer({key,cert},(request,response)=>{
  try{const body=render(new URL(request.url,'https://localhost'),request);response.writeHead(body===null?404:200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});response.end(body)}catch{response.writeHead(500);response.end('Synthetic provider request failed')}
 })
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)})
 return {origin:'https://localhost:'+server.address().port,async close(){server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}}
}
