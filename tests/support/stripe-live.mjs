// The real HTTP network boundary: Node has already decoded content compression.
export const liveStripe=results=>async request=>{
 const forwarded=new Headers(request.headers);for(const name of ['host','connection','content-length','transfer-encoding'])forwarded.delete(name)
 let response
 try{response=await fetch(request.url,{method:request.method,headers:Object.fromEntries(forwarded),...(request.method==='GET'?{}:{body:await request.arrayBuffer()})})}catch(error){results.transportFailure={name:error.name,code:error.cause?.code??null};throw error}
 ;(results.http??=[]).push({resource:new URL(request.url).pathname,method:request.method,status:response.status,bytes:(await response.clone().arrayBuffer()).byteLength,compression:response.headers.get('content-encoding')})
 if(response.ok&&request.method==='POST'&&['/v1/checkout/sessions','/v1/payment_intents'].includes(new URL(request.url).pathname)){
  const object=await response.clone().json();if(typeof object.id==='string')((new URL(request.url).pathname.endsWith('/sessions')?results.createdSessionIds??=[]:results.createdPaymentIntentIds??=[])).push(object.id)
 }
 if(!response.ok){
  const body=await response.clone().json().catch(()=>null),error=body?.error,message=typeof error?.message==='string'?error.message:''
  const safe=value=>typeof value==='string'&&/^[a-zA-Z0-9_.\[\]-]{1,120}$/.test(value)?value:null
  ;(results.providerErrors??=[]).push({resource:new URL(request.url).pathname,status:response.status,code:safe(error?.code),type:safe(error?.type),param:safe(error?.param),accountActivation:/activat|business.*name|business.*url|cannot.*charges|charges.*enabled|charges.*disabled/i.test(message),paymentMethod:/payment_method_types|card_present|us_bank_account/i.test(message),compression:response.headers.get('content-encoding')})
 }
 const headers=new Headers(response.headers);headers.delete('content-encoding');headers.delete('content-length')
 return new Response(response.body,{status:response.status,headers})
}
export async function archiveCheckoutCatalog(stripe,sessionId,results){
 const items=await stripe('/checkout/sessions/'+encodeURIComponent(sessionId)+'/line_items?limit=100')
 if(items.has_more)throw Error('Unexpected multi-page invoice checkout')
 for(const item of items.data){
  const price=item.price,product=typeof price?.product==='string'?price.product:price?.product?.id
  if(!price?.id||!product||price.livemode!==false)throw Error('Only this test checkout catalogue may be archived')
  if(price.active)await stripe('/prices/'+encodeURIComponent(price.id),{active:'false'})
  await stripe('/products/'+encodeURIComponent(product),{active:'false'})
 }
 results.cleanup.push('inline test checkout catalogue archived')
}
