import {area,box,e,field,form,money,rows,select,when} from './common'
import {retailReport} from '../retail'
export function retailPage(s:any){
 const report=retailReport(s)
 let body='<p><a href="/app/inventory">Stock & receiving</a> · <a href="/app/tax">Sales tax settings</a> · <a href="/api/mallet/retail">Counter cash report (JSON)</a></p><p>Current owner · Home shop · USD cash only. Scan or type accessory and bin barcodes. Receipts retain the original price and tax. This records physical cash; drawer close and bank deposits are not included.</p>'
 body+=box('Record cash sale',form('retail.sell',field('Unique sale reference','reference','text',crypto.randomUUID(),'required maxlength="200"')+field('Accessory barcode','itemBarcode','text','','required maxlength="100"')+field('Bin barcode','binBarcode','text','','required maxlength="100"')+select('Stock lot','lotId',[['','Untracked stock'],...rows(s,'stockLot').filter(l=>!l.serial).map(l=>[l.id,l.supplierLot+' · '+l.reference] as [string,string])])+field('Quantity','quantity','number',1,'required min="1" max="1000" step="1"')+field('Unit price (USD)','unitUsd','number','','required min="0" max="1000000" step="0.01"')+field('Cash received (USD)','cashUsd','number','','required min="0" max="10000000" step="0.01"'),'Record cash sale'))
 body+=box('Recorded counter cash',`<p>Sales ${money(report.soldCents)} · Cash returned ${money(report.returnedCents)} · Net cash ${money(report.netCashCents)}</p>`)
 for(const sale of [...report.sales].reverse()){
  const returns=report.returns.filter(r=>r.saleId===sale.id),remaining=sale.quantity-returns.reduce((n,r)=>n+r.quantity,0)
  body+=box('Receipt '+sale.reference,`<article id="receipt-${e(sale.id)}"><h3>${e(sale.description)}</h3><p>${e(sale.sku)} · ${e(sale.quantity)} × ${money(sale.unitCents)}<br>Subtotal ${money(sale.subtotalCents)} · Sales tax ${money(sale.salesTaxCents)} · Total ${money(sale.totalCents)}<br>Cash received ${money(sale.cashCents)} · Change ${money(sale.changeCents)}<br>${e(sale.by.name)} · ${when(sale.at)}</p><p>Receipt ID ${e(sale.id)}</p><ul>${returns.map(r=>`<li>Return ${e(r.reference)} · Quantity ${e(r.quantity)} · Subtotal ${money(r.subtotalCents)} · Tax ${money(r.salesTaxCents)} · Cash ${money(r.totalCents)} · ${e(r.reason)} · ${e(r.by.name)} · ${when(r.at)}</li>`).join('')}</ul>${remaining?`<details><summary>Record accessory return</summary><p>${e(remaining)} remaining. Return only inspected saleable stock to its original bin and record cash handed back.</p>${form('retail.return',field('Unique return reference','reference','text',crypto.randomUUID(),'required maxlength="200"')+field('Returned quantity','quantity','number',1,`required min="1" max="${remaining}" step="1"`)+area('Inspection and cash return evidence','reason','','required maxlength="2000"')+'<label><input type="checkbox" name="confirm" value="saleable-cash-returned" required> I inspected the returned stock as saleable and handed back the receipt-based cash refund.</label>','Record cash return',{saleId:sale.id})}</details>`:'<p>Fully returned; original receipt preserved.</p>'}</article>`)
 }
 return '<div class="narrow">'+body+'</div>'
}
export function retailFormInput(p:any){
 if(!String(p.command).startsWith('retail.'))return
 p.quantity=Number(p.quantity)
 if(p.command==='retail.sell'){p.unitCents=Math.round(Number(p.unitUsd)*100);p.cashCents=Math.round(Number(p.cashUsd)*100)}
}
