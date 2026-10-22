// What each outside service receives, returns, keeps and licenses, published before the owner enables it (GOV-005).
// The version rises whenever a declaration changes; saving a secret acknowledges the version the owner read.
export type Declaration={id:string;name:string;version:number;purpose:string;sends:string[];receives:string[];retention:string;licensing:string;access:string
 secrets:{name:string;label:string;rotatable:boolean}[]}
export const CONNECTORS:Declaration[]=[
 {id:'stripe',name:'Stripe',version:1,purpose:'Confirm that a customer’s card payment was captured, and submit refunds the owner has reviewed.',
  sends:['A payment-intent identifier to look up','For a refund: the payment-intent identifier, the refund amount in USD cents and a Mallet refund identifier, only after the owner confirms it'],
  receives:['Payment status, captured amount, currency, charge identifier and dispute/refund flags','Refund identifier and status'],
  retention:'Mallet keeps the processor’s receipt fields with the invoice or refund record for the life of the repair history. Stripe keeps its own records under its own policy. No card numbers ever reach Mallet.',
  licensing:'Your own Stripe account and the Stripe Services Agreement. Use a restricted key that can read payment intents and create and read refunds only.',
  access:'Owner only. Reads and refund requests run only when a person triggers them; Mallet never retries a refund automatically.',secrets:[{name:'STRIPE_SECRET_KEY',label:'Restricted API key',rotatable:true}]},
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
]
export const connector=(id:string)=>CONNECTORS.find(c=>c.id===id)
