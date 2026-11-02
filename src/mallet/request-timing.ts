/** Server timing contains only a fixed route class, never IDs, queries or credentials. */
function routeClass(path:string):string|null {
 if(path==='/api/mallet/accounts'||path==='/app/accounts')return 'account-search'
 if(path==='/app'||path==='/api/mallet/board')return 'board'
 if(path==='/api/mallet/board-revision')return 'board-revision'
 if(/^\/(?:api\/mallet\/repairs|app\/jobs)\/[^/]+$/.test(path))return 'repair-open'
 if(/^\/api\/mallet\/media\/uploads\/[^/]+\/complete$/.test(path))return 'photo-acknowledgment'
 return null
}
export async function timedMalletResponse(request:Request,run:()=>Promise<Response|null>):Promise<Response|null> {
 const route=routeClass(new URL(request.url).pathname)
 if(!route)return run()
 const started=performance.now(),response=await run()
 if(!response)return null
 const durationMs=Math.round((performance.now()-started)*1000)/1000,headers=new Headers(response.headers)
 headers.append('server-timing',`mallet;dur=${durationMs}`)
 console.info(JSON.stringify({event:'mallet_request',route,method:request.method,status:response.status,durationMs}))
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers})
}
