import {fail,rows,type State} from '../model'
// Keep a fixed hosted amount valid until the owner explicitly resolves its session.
export function guardCheckoutBalance(s:State,command:string,input:any){
 if(!['payment.record','payment.verified','deposit.allocate','credit.issue','credit.apply','credit.exchange'].includes(command))return
 if(rows(s,'stripeCheckout').some(r=>r.invoiceId===input.invoiceId&&['claiming','open','uncertain','processing'].includes(r.status)))fail('STRIPE_OPEN','Expire or reconcile the hosted checkout before recording other tender or invoice credits.')
}
