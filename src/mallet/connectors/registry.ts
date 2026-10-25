// What each outside service receives, returns, keeps and licenses, published before the owner enables it (GOV-005).
// The version rises whenever a declaration changes; saving a secret acknowledges the version the owner read.
export type Declaration={id:string;name:string;version:number;purpose:string;sends:string[];receives:string[];retention:string;licensing:string;access:string
 secrets:{name:string;label:string;rotatable:boolean}[]}
export const CONNECTORS:Declaration[]=[
 {id:'stripe',name:'Stripe',version:2,purpose:'Create owner-confirmed hosted invoice checkout, read payment events and reconcile captured amounts, processor fees and automatic payout membership; submit reviewed refunds.',
  sends:['Merchant account and balance reads','Exact invoice identifier, revision, number, USD balance and hosted method when the owner creates checkout','Checkout identifiers for explicit open or expire actions; payment event, intent and automatic payout identifiers for owner-requested reconciliation','For a refund: the payment-intent identifier, USD cents and a Mallet refund identifier after owner confirmation'],
  receives:['Merchant account, settlement currency and mode','Hosted checkout identifier and address, payment status, captured amount, charge and dispute or refund flags','Provider event identifiers, charge balance transactions, gross, fee, net and automatic payout membership and status','Refund identifier and status'],
  retention:'Mallet retains non-secret account, checkout, event, payment and settlement evidence with repair history. Hosted checkout addresses are fetched for the owner and excluded from archives. Stripe keeps its records under its policy. Card numbers and bank credentials never reach Mallet.',
  licensing:'Your own Stripe account and the Stripe Services Agreement. The key must read the account, balance, events, payment intents, charges, balance transactions and payouts; create and expire Checkout Sessions; and create and read reviewed refunds.',
  access:'Owner initiates checkout and reconciliation with an enrolled second factor and fresh confirmation. Existing advisor receipt checks retain their scope. No automatic charge or outbound retry; provider status never proves bank receipt.',secrets:[{name:'STRIPE_SECRET_KEY',label:'Stripe API key',rotatable:true}]},
 {id:'pier',name:'Pier',version:1,purpose:'Browse the parts catalog of a connected Pier installation, read-only.',
  sends:['An authenticated read request for the parts list'],receives:['Item identifiers, SKUs, names and units; never stock balances or costs'],
  retention:'Mallet shows what it observed at the time and records the part identifiers a repair uses; nothing is written back to Pier.',
  licensing:'Your own Pier installation under its own licence. Use a session limited to catalog reading.',access:'Owner and service advisors only.',secrets:[{name:'PIER_SESSION',label:'Pier session',rotatable:true}]},
 {id:'mail-events',name:'Email delivery events',version:1,purpose:'Accept signed delivered, deferred and bounced notices from your email provider about inspection reports.',
  sends:['Nothing: the provider calls Mallet'],receives:['Event identifier, time, status, provider message identifier and the one recipient address of a report Mallet sent'],
  retention:'The event identifier and status are kept with the report delivery record. Unsigned, stale, foreign-recipient or unmatched events are refused and not stored.',
  licensing:'Your email provider’s terms (Resend or SendGrid). The signing secret is shown to you only by the provider.',access:'No session: the provider’s signature is the only authority.',secrets:[{name:'MAIL_EVENT_KEY',label:'Webhook signing secret',rotatable:true}]},
 {id:'mail',name:'Email sending',version:1,purpose:'Send sign-in links, approval links, confirmations and reports you ask Mallet to send.',
  sends:['Recipient address, subject and the message you reviewed; never payment or card details'],receives:['An accepted, rejected or rate-limited answer and a provider message identifier'],
  retention:'Mallet keeps the delivery outcome, never an automatic retry. The provider keeps message logs under its own policy.',
  licensing:'Your Resend, SendGrid or Cloudflare email account and its terms.',access:'Sent only on a person’s request, or by the shop’s published reminder policy.',secrets:[{name:'MAIL_API_KEY',label:'Sending key (set in your Cloudflare account)',rotatable:false}]},
 {id:'supplier-gateway',name:'Supplier ordering gateway',version:1,purpose:'Compare quotes and explicitly submit, reconcile, cancel or reject substitutions through your authorized supplier-order.v1 gateway.',
  sends:['For comparison: catalog SKU, unit and requested quantity only','After exact cart approval: supplier/quote identifiers, SKU, grade, quantity, unit price, total USD cents, ship-to address and opaque Mallet purchase reference','Only on explicit request: cancellation or substitution rejection and its opaque identifiers'],
  receives:['Supplier availability, compatibility/grade, price, cutoff, freight/tax and ETA with observation/expiry times','Exact acknowledged, rejected, cancelled or proposed-substitution order evidence'],
  retention:'Mallet retains bounded quote, approval, custody and order outcome history with the purchase. The gateway retains its own records under your agreement. Credentials are excluded from product records and archives.',
  licensing:'Your authorized supplier gateway implementing docs/supplier-ordering.md; direct PartsTech, Nexpart and Worldpac licensing remains BUY-003/004/005.',
  access:'Owner enables/rotates/revokes the private key after reading this declaration. Owner/admin operators explicitly approve exact spend and each outbound action. A claimed POST is never automatically repeated; uncertain outcomes use GET reconciliation only.',secrets:[{name:'MALLET_SUPPLIER_KEY',label:'Supplier gateway API key',rotatable:true}]},
]
export const connector=(id:string)=>CONNECTORS.find(c=>c.id===id)
