import {e,field,area,select,form,box,rows,money,when} from './common'
import {purchaseStatus} from '../purchasing'
const qty=(label:string,name:string,value:unknown='',zero=false)=>field(label,name,'number',value,'required min="'+(zero?'0':'0.001')+'" step="0.001"')
const usd=(label:string,name:string,value:unknown='0')=>field(label,name,'number',value,'required min="0" step="0.01"')
export function purchasingPage(state:any){
 const items:[string,string][]=rows(state,'stockItem').map(i=>[i.id,i.sku+' · '+i.name]),jobs:[string,string][]=[['','Stock need'],...rows(state,'job').filter(j=>['booked','working'].includes(j.status)).map(j=>[j.id,j.title] as [string,string])]
 const line=(n:number)=>`<fieldset><legend>Line ${n+1}</legend>`+select('Part '+(n+1),'item'+n,items)+qty('Order quantity '+(n+1),'quantity'+n)+usd('Unit cost '+(n+1)+' (USD)','cost'+n)+select('Demand '+(n+1),'job'+n,jobs)+'</fieldset>'
 const create=items.length?box('New purchase order',form('purchase.create',field('PO reference','reference','text','','required')+field('Supplier','supplier','text','','required')+area('Ship-to address','shipTo','','required')+field('Expected date (ISO with timezone)','expectedAt','text','','required')+line(0)+line(1)+usd('Supplier tax (USD)','taxUsd')+usd('Freight (USD)','freightUsd'),'Prepare two-line PO')):box('New purchase order','<p><a href="/app/inventory">Register stock parts</a> before preparing purchase orders.</p>')
 const orders=rows(state,'purchaseOrder').map(po=>{
  const status=purchaseStatus(state,po),refs={purchaseId:po.id,version:po.version}
  let body=`<p>${e(po.supplier)} · ${e(po.status)} · Approved spend ${money(po.approval?.totalCents??0)}<br>Prepared total ${money(po.totalCents)} including supplier tax ${money(po.taxCents)} and freight ${money(po.freightCents)}<br>Ship to ${e(po.shipTo)} · Expected ${when(po.expectedAt)}</p>`
  body+='<ul class="list">'+status.lines.map((l:any)=>`<li class="plain"><strong>${e(l.name)}</strong><p>Ordered ${e(l.quantityMilli/1000)} × ${money(l.unitCents)} · Received ${e(l.receivedMilli/1000)} · Backorder ${e(l.backorderMilli/1000)}${l.shortClosedMilli?` · Short-closed ${e(l.shortClosedMilli/1000)}`:''}<br>${l.jobId?`Reserved on receipt for <a href="/app/jobs/${e(l.jobId)}">waiting repair</a>`:'Stock need'}</p></li>`).join('')+'</ul>'
  if(!po.approval)body+=form('purchase.approve',area('Spend approval reason','reason','','required'),'Approve spend',refs)
  else body+=`<p>Spend approved by ${e(po.approval.by.name)} · ${when(po.approval.at)} · ${e(po.approval.reason)}</p>`
  if(po.approval&&!po.closed){
   const choices:[string,string][]=status.lines.filter((l:any)=>l.backorderMilli>0).map((l:any)=>[l.id,l.name+' · outstanding '+l.backorderMilli/1000])
   if(choices.length)body+=`<details><summary>Receive goods</summary>`+form('purchase.receive',select('PO line','lineId',choices)+field('Part barcode','itemBarcode','text','','required')+field('Bin barcode','binBarcode','text','','required')+qty('Physical quantity received','quantity')+field('Goods receipt reference','reference','text','','required'),'Receive PO goods',refs)+'</details>'
   if(choices.length)body+=`<details><summary>Short-close backorders</summary><p>Owner and admin operators can permanently short-close all remaining quantities shown above. Original approved spend and receipt history are retained. Match a new supplier bill to physically received quantities and approved unit costs, tax and freight before closing the PO.</p>`+form('purchase.shortClose',area('Short-close reason','reason','','required'),'Short-close remaining quantities',refs)+'</details>'
   body+=`<details><summary>Record supplier bill</summary>`+form('purchase.bill',field('Supplier invoice number','invoiceNumber','text','','required')+status.lines.map((l:any,n:number)=>`<fieldset><legend>${e(l.name)}</legend><input type="hidden" name="billLine${n}" value="${e(l.id)}">`+qty('Billed quantity '+(n+1),'billQuantity'+n,l.receivedMilli/1000,true)+usd('Billed unit cost '+(n+1)+' (USD)','billCost'+n,l.unitCents/100)+'</fieldset>').join('')+usd('Billed supplier tax (USD)','taxUsd',po.taxCents/100)+usd('Billed freight (USD)','freightUsd',po.freightCents/100)+area('Supplier bill evidence','evidence','','required'),'Match supplier bill',refs)+'</details>'
   body+=form('purchase.close',area('Closure reason','reason','','required'),'Close matched PO',refs)
  }
  if(po.shortClose)body+=box('Short-close decision',`<p>${e(po.shortClose.reason)} · ${e(po.shortClose.by.name)} · ${when(po.shortClose.at)}<br>Original approved spend ${money(po.shortClose.approval.totalCents)} retained. ${status.fullyReceived?'All goods physically received.':'Short-closed quantities were not received.'}</p>`)
  if(po.closed)body+=`<p>Closed by ${e(po.closed.by.name)} · ${when(po.closed.at)} · ${e(po.closed.reason)}</p>`
  body+=box('Goods receipts',status.receipts.map(r=>`<p>${e(r.reference)} · ${e(status.lines.find((l:any)=>l.id===r.lineId)?.name)} · ${e(r.quantityMilli/1000)} · ${e(r.by.name)} · ${when(r.at)}</p>`).join('')||'<p>No goods received.</p>')
  body+=box('Bill matching history',status.bills.map(b=>`<article><h3>${e(b.invoiceNumber)} · ${b.matched?'Matched':'Exception'}</h3><p>${money(b.totalCents)} · ${e(b.evidence)} · ${e(b.by.name)} · ${when(b.at)}</p><ul>${b.exceptions.map((v:string)=>`<li>${e(v)}</li>`).join('')}</ul></article>`).join('')||'<p>No supplier bill recorded.</p>')
  return box(po.reference,body,{id:'po-'+po.id})
 }).join('')
 return '<p><a href="/app/purchasing/suppliers">Compare supplier stock & order</a> · <a href="/app/inventory">Stock & receiving</a> · <a href="/api/mallet/purchasing">Purchase order and matching report (JSON)</a></p><p>Owner and admin operators retain approved spend, physical receipt and supplier evidence. Order submission and accounting posting remain separate steps.</p><div class="grid wide-left"><div class="col">'+(orders||box('Purchase orders','<p>No purchase orders yet.</p>'))+'</div><div class="col">'+create+'</div></div>'
}
export function purchasingFormInput(input:any){
 if(!String(input.command).startsWith('purchase.'))return
 for(const k of ['version','quantity'])if(k in input)input[k]=Number(input[k])
 if(input.command==='purchase.create')input.lines=[0,1].map(n=>({itemId:input['item'+n],quantity:Number(input['quantity'+n]),unitCents:Math.round(Number(input['cost'+n])*100),jobId:input['job'+n]}))
 if(input.command==='purchase.bill'){input.lines=[];for(let n=0;input['billLine'+n]!==undefined;n++)input.lines.push({lineId:input['billLine'+n],quantity:Number(input['billQuantity'+n]),unitCents:Math.round(Number(input['billCost'+n])*100)})}
 if(['purchase.create','purchase.bill'].includes(input.command)){input.taxCents=Math.round(Number(input.taxUsd)*100);input.freightCents=Math.round(Number(input.freightUsd)*100)}
}
