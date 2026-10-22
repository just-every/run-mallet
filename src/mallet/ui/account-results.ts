import {box,e,field} from './common'

type AccountResult={id:string;name:string;kind:string;taxStatus:string;notes:string;contactIds:string[]}
type AccountSearchResult={accounts:AccountResult[];nextCursor:string|null;total:number}

/** The owner/admin route supplies one bounded search page, without loading the
 * shop-wide contact, vehicle or management-control catalogs into this view. */
export function accountResultsPage(q:string,result:AccountSearchResult){
 const search=`<form method="get" action="/app/accounts">${field('Search accounts by name, phone or plate','q','search',q,'maxlength="200"')}<button>Search accounts</button></form>`
 const summary=`<p>${e(result.total)} matching account${result.total===1?'':'s'} · showing ${e(result.accounts.length)} on this page.</p>`
 const accounts=result.accounts.map(account=>{
  const details='/app/accounts?'+new URLSearchParams({manage:account.id}).toString()
  return box(account.name,`<p>${e(account.kind)} · ${e(account.taxStatus)}</p><p>${e(account.notes)}</p><p>${e(account.contactIds.length)} linked contact${account.contactIds.length===1?'':'s'}</p><p><a href="${e(details)}">Open account and vehicle details</a></p>`,{id:'account-'+account.id})
 }).join('')||box('Customer accounts','<p>No matching accounts.</p>')
 const next=result.nextCursor?`<p><a href="/app/accounts?${e(new URLSearchParams({q,cursor:result.nextCursor}).toString())}">Next accounts</a></p>`:''
 return `<div class="narrow"><p>Search matches account or contact names, contact email or phone, and vehicle identity.</p>${search}${summary}<p><a href="/app/accounts?manage=all">Manage accounts and contacts</a></p>${accounts}${next}</div>`
}
