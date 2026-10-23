import {area,box,e,field,form,money,rows,select} from './common'
import {transferReport} from '../stock-transfers'
import {lotRemaining} from '../stock-trace'
const note=()=>area('Custody evidence','evidence','','required')
const qty=(label:string,name:string,value=1)=>field(label,name,'number',value,'required min="0" step="0.001"')
export function transfersPage(s:any){
 const bins=rows(s,'stockBin'),label=(b:any)=>b?(b.location?b.location+' · ':'')+b.code:'',lots=rows(s,'stockLot').filter(l=>lotRemaining(s,l)>0),choices:[string,string][]=lots.map(l=>[l.id,label(bins.find(b=>b.id===l.binId))+' · '+l.supplierLot+' · '+(l.serial||'lot')+' · '+lotRemaining(s,l)/1000])
 let body='<p><a href="/app/inventory">Stock & receiving</a> · <a href="/api/mallet/transfers">Transfer custody report (JSON)</a></p><p>Request and approval move no stock. Dispatch removes sending availability and retains lot/serial and frozen unit cost in transit. Receipt adds only undamaged physically received stock. Shortages stay in transit and damaged units stay quarantined until a reasoned correction is approved.</p>'
 for(const t of transferReport(s)){
 const refs={transferId:t.id,version:t.version}
 let content=`<p>${e(label(t.source))} → ${e(label(t.destination))} · ${e(t.status)}<br>${e(t.reason)}</p><ul>`+t.lines.map((l:any)=>`<li>${e(l.lot.supplierLot)} · Serial ${e(l.lot.serial||'None')} · ${l.quantityMilli/1000} at ${money(l.unitCostCents)} per unit · In transit ${l.inTransitMilli/1000} · Received ${l.receivedMilli/1000} · Quarantined ${l.quarantinedMilli/1000}</li>`).join('')+'</ul>'
 if(t.status==='requested')content+=form('stock.transferApprove',area('Transfer approval reason','reason','','required'),'Approve exact transfer',refs)
 if(t.status==='approved')content+=form('stock.transferDispatch',note(),'Dispatch approved transfer',refs)
 if(t.status==='in-transit')content+=form('stock.transferReceive',t.lines.map((l:any,n:number)=>`<fieldset><legend>${e(l.lot.serial||l.lot.supplierLot)}</legend><input type="hidden" name="receiptLine${n}" value="${e(l.id)}">`+qty('Undamaged received '+(n+1),'received'+n,0)+qty('Damaged received '+(n+1),'damaged'+n,0)+'</fieldset>').join('')+note(),'Receive physical transfer',refs)
 if(t.dispatch)content+=`<p>Dispatch evidence: ${e(t.dispatch.evidence)}</p>`
 if(t.receipt)content+=`<p>Receipt evidence: ${e(t.receipt.evidence)}</p>`
 for(const ex of t.exceptions){content+=`<h3>${e(ex.kind)} · ${e(t.lines.find((l:any)=>l.id===ex.lineId)?.lot.serial||'Lot')} · ${ex.quantityMilli/1000}</h3><p>${e(ex.evidence)}</p>`;content+=ex.correction?`<p>Approved correction: ${e(ex.correction.outcome)} · ${e(ex.correction.reason)} · ${e(ex.correction.evidence)} · ${e(ex.correction.approvedBy.name)}</p>`:form('stock.transferCorrect',select('Verified disposition','outcome',ex.kind==='shortage'?[['received','Found and received at destination'],['returned','Returned to sending bin'],['lost','Confirmed lost; no stock added']]:[['received','Inspected and accepted at destination'],['destroyed','Confirmed destroyed; no stock added']])+area('Correction approval reason','reason','','required')+note(),'Approve custody correction',{...refs,exceptionId:ex.id})}
 body+=box(t.reference,content)
 }
 if(lots.length&&bins.length>1)body+=box('Request transfer',form('stock.transferRequest',field('Unique transfer reference','reference','text','','required')+select('Sending lot / serial 1','lot0',choices)+qty('Quantity 1','quantity0')+select('Sending lot / serial 2 (optional)','lot1',[['','One line only'],...choices])+qty('Quantity 2','quantity1')+select('Destination shop / bin','destinationBinId',bins.map(b=>[b.id,label(b)]))+area('Transfer request reason','reason','','required'),'Request stock transfer'))
 if(bins.length)body+=box('Label shop locations',bins.map(b=>form('stock.location',`<p>Bin ${e(b.code)}</p>`+field('Shop/location label','location','text',b.location??'','required'),'Save shop label',{binId:b.id,version:b.version})).join(''))
 return '<div class="narrow">'+body+'</div>'
}
export function transferFormInput(p:any){
 if(p.command==='stock.location'||String(p.command).startsWith('stock.transfer'))if('version'in p)p.version=Number(p.version)
 if(p.command==='stock.transferRequest')p.lines=[0,1].filter(n=>p['lot'+n]).map(n=>({lotId:p['lot'+n],quantity:Number(p['quantity'+n])}))
 if(p.command==='stock.transferReceive'){p.lines=[];for(let n=0;p['receiptLine'+n];n++)p.lines.push({lineId:p['receiptLine'+n],received:Number(p['received'+n]),damaged:Number(p['damaged'+n])})}
}
