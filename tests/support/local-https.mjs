import {request} from 'node:https'
/** Real HTTPS to the test runtime's self-signed loopback listener, preserving its hostname and Host. */
export function localHttps(url,options={}){
 const target=new URL(url)
 if(!['127.0.0.1','localhost','[::1]'].includes(target.hostname))throw Error('Test TLS transport only admits loopback')
 return new Promise((resolve,reject)=>{
  const outgoing=request(target,{method:options.method??'GET',headers:options.headers,rejectUnauthorized:false},incoming=>{
   const chunks=[];incoming.on('data',chunk=>chunks.push(chunk));incoming.on('error',reject);incoming.on('end',()=>{
    const headers=new Headers();for(let i=0;i<incoming.rawHeaders.length;i+=2)headers.append(incoming.rawHeaders[i],incoming.rawHeaders[i+1])
    resolve(new Response([204,205,304].includes(incoming.statusCode)?null:Buffer.concat(chunks),{status:incoming.statusCode,headers}))
   })
  });outgoing.on('error',reject);if(options.body!==undefined)outgoing.write(options.body);outgoing.end()
 })
}
