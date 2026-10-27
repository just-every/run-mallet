import {e,box,field,form,select,when} from './common'
import {CONNECTORS,type Declaration} from '../connectors/registry'
const list=(items:string[])=>`<ul>${items.map(x=>`<li>${e(x)}</li>`).join('')}</ul>`
const declaration=(c:Declaration)=>`<h3>${e(c.name)} <span class="row-meta">declaration version ${c.version}</span></h3><p>${e(c.purpose)}</p><h4>What Mallet sends</h4>${list(c.sends)}<h4>What comes back</h4>${list(c.receives)}<h4>Retention</h4><p>${e(c.retention)}</p><h4>Licence and access</h4><p>${e(c.licensing)}</p><p>${e(c.access)}</p>`
/** Published to everyone before any connector is enabled. */
export const publishedConnectors=()=>`<div class="narrow"><p class="lede">Every outside service Mallet can talk to, what crosses the line in each direction, what is kept and under whose terms. Nothing is enabled until the owner reads its declaration and saves its credential.</p>${CONNECTORS.map(c=>box(c.name,declaration(c))).join('')}</div>`
export function connectorsPage(actor:{role:string},status:Record<string,any>,woo?:any){
 const owner=actor.role==='owner'
 return `<div class="narrow"><p><a href="/app/stripe">Stripe merchant connection</a></p><p class="lede">Credentials are sealed when saved and never shown again; only a short fingerprint tells you which one is in use. Enrol your own second factor before saving a credential. Saving a new one replaces the old for good. Read the <a href="/connectors">published declarations</a> first.</p>${CONNECTORS.map(c=>box(c.name,declaration(c)+(c.id==='woocommerce'&&owner&&woo?wooSettings(woo):'')+c.secrets.map(s=>{
  const row=status[c.id+':'+s.name],state=row?row.status==='active'?`Saved version ${row.version}, fingerprint <code>${e(row.fingerprint)}</code>, ${when(new Date(row.changedAt).toISOString())}`:`Revoked (version ${row.version}); nothing uses it`:'From your deployment’s own settings'
  return `<h4>${e(s.label)}</h4><p>${state}</p>${owner&&s.rotatable?form('connector.save',field('New credential','credential','password','','required autocomplete="off" maxlength="4096"')+`<label><input type="checkbox" name="acknowledge" value="${c.version}" required> I have read the ${e(c.name)} declaration above</label>`,row?.status==='active'?'Rotate credential':'Save credential',{connector:c.id,name:s.name})+(row?.status==='active'||!row?form('connector.revoke','','Revoke',{connector:c.id,name:s.name}):''):''}`
 }).join(''))).join('')}</div>`
}

function wooSettings(view:any){
 const connection=view.connection
 return `<p>Stock authority: Mallet. Online payment status is observed provider evidence; it never records counter cash. A refund alone does not prove returned goods.</p><p>${connection?.enabled?'Enabled at '+e(connection.origin):'Disabled; restored history has no connection authority.'}</p>`+
 form('woocommerce.enable',field('Store origin','origin','url',connection?.origin??'','required')+`<label><input type="checkbox" name="acknowledge" value="1" required> I read the WooCommerce declaration and approve Mallet stock authority.</label>`,'Enable connection',{authority:'mallet'})+
 (connection?.enabled?form('woocommerce.disable','','Disable connection')+
 form('woocommerce.map',field('WooCommerce product ID','productId','number','','required min="1"')+select('Native item','itemId',view.items.map((i:any)=>[i.id,i.sku+' · '+i.name]))+select('Native bin','binId',view.bins.map((i:any)=>[i.id,i.code])),'Map verified product')+
 form('woocommerce.reconcile',field('WooCommerce order ID','orderId','number','','required min="1"')+field('Returned goods: approved refund IDs (optional)','restockRefundIds','text','','placeholder="Comma separated observed refund IDs"')+'<p>Enter refund IDs only after inspecting the returned goods. This restores their quantities once to the mapped native bin.</p>','Read current order and refunds'):'')+
 `<h4>Mapped products</h4><ul>${view.mappings.map((m:any)=>`<li>Product ${e(m.productId)} · ${e(m.sku)} · ${m.connectionId===connection?.id?'Current connection':'Historical connection'}</li>`).join('')}</ul><h4>Observed orders</h4><ul>${view.orders.map((o:any)=>`<li>Order ${e(o.providerId)} · ${e(o.status)} · ${e(o.transactionId||'No payment identifier observed')} · ${e(o.totalCents)} USD cents<ul>${o.lines.map((l:any)=>`<li>Line ${e(l.id)} · quantity ${e(l.quantity)} · native net debit ${e(o.applied[l.id])} thousandths</li>`).join('')}</ul></li>`).join('')}</ul><h4>Observed line refunds</h4><ul>${view.refunds.map((r:any)=>`<li>Refund ${e(r.providerId)} · order ${e(r.orderId)} · ${e(r.receipt.amountCents)} USD cents</li>`).join('')}</ul>`
}
