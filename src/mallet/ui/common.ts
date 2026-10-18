import type { Actor } from '../auth'
export const e=(v:unknown):string=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
export const money=(cents:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'AUD',currencyDisplay:'narrowSymbol'}).format((cents??0)/100)
export const hidden=(name:string,value:unknown)=>`<input type="hidden" name="${e(name)}" value="${e(value)}">`
export const field=(label:string,name:string,type='text',value:unknown='',extra='')=>`<label>${e(label)}<input name="${e(name)}" type="${type}" value="${e(value)}" ${extra}></label>`
export const select=(label:string,name:string,options:[string,string][],selected='')=>`<label>${e(label)}<select name="${e(name)}">${options.map(([value,text])=>`<option value="${e(value)}"${value===selected?' selected':''}>${e(text)}</option>`).join('')}</select></label>`
export const area=(label:string,name:string,value='',extra='')=>`<label>${e(label)}<textarea name="${e(name)}" ${extra}>${e(value)}</textarea></label>`
export const form=(command:string,content:string,button:string,values:Record<string,unknown>={},kind='')=>`<form method="post" action="/app/actions"${kind?` class="${kind}"`:''}>${hidden('command',command)}${Object.entries(values).map(([k,v])=>hidden(k,v)).join('')}${content}<button>${e(button)}</button></form>`
// A card: its title (with an optional status pill or step figure beside it) and content.
export const box=(title:string,content:string,{pill='',step='',extra='',id=''}:{pill?:string,step?:string|number,extra?:string,id?:string}={})=>`<section${id?` id="${e(id)}"`:''} class="card${extra?` ${extra}`:''}">${pill?'<div class="card-head">':''}<h2>${step!==''?`<span class="step">${e(step)}.</span> `:''}${e(title)}</h2>${pill}${pill?'</div>':''}${content}</section>`
// Technicians are stored as operator IDs; show the operator's name (free text from older bookings is shown as typed, and an operator who is gone is not shown as an ID).
export type Names=Record<string,string>
export const person=(names:Names,id:unknown)=>names[String(id)]??(/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(String(id))?'Former team member':String(id??''))
export const badge=(value:unknown)=>`<span class="pill">${e(value)}</span>`
export const rows=(state:any,kind:string):any[]=>state.records[kind]??[]
// A list row whose whole area is one link; the chevron shows on phones.
export const linkRow=(href:string,title:string,meta:string,pill='')=>`<li><a class="row" href="${e(href)}"><span class="row-title"><span class="row-name">${e(title)}</span>${pill}</span><span class="row-meta">${meta}</span></a></li>`
export const join=(...parts:unknown[])=>parts.filter(part=>part!==undefined&&part!==null&&part!=='').map(e).join(' · ')

// Times are stored as UTC ISO strings. The page shows them as "Oct 19, 9:00 am – 10:00 am EDT" in the browser's own
// timezone (the script below rewrites each [data-at]); without JavaScript the server's UTC rendering stays, marked UTC.
type Show='time'|'date'|'date-year'
const stamp=(at:string,until:string|undefined,show:string,timeZone?:string)=>{
 const parts=(d:Date,o:Intl.DateTimeFormatOptions)=>Object.fromEntries(new Intl.DateTimeFormat('en-US',{...o,timeZone}).formatToParts(d).map(x=>[x.type,x.value]))
 const day=(d:Date)=>{const x=parts(d,{day:'numeric',month:'short'});return x.month+' '+x.day}
 const time=(d:Date)=>{const x=parts(d,{hour:'numeric',minute:'2-digit',hour12:true});return x.hour+':'+x.minute+' '+String(x.dayPeriod).toLowerCase()}
 const a=new Date(at),zone=()=>' '+parts(a,{timeZoneName:'short',hour:'numeric'}).timeZoneName
 if(show==='date-year'){const x=parts(a,{day:'numeric',month:'short',year:'numeric'});return x.month+' '+x.day+', '+x.year}
 let text=show==='date'?day(a):day(a)+', '+time(a)
 if(until){const b=new Date(until);text+=' – '+(day(b)===day(a)?time(b):day(b)+', '+time(b))}
 return show==='date'?text:text+zone()
}
export function when(at:unknown,until?:unknown,show:Show='time') {
 if(typeof at!=='string'||!Number.isFinite(Date.parse(at)))return e(at)
 const end=typeof until==='string'&&Number.isFinite(Date.parse(until))?until:undefined
 return `<time datetime="${e(at)}" title="${e(end?`${at} – ${end}`:at)}" data-at="${e(at)}"${end?` data-until="${e(end)}"`:''} data-show="${show}">${e(stamp(at,end,show,'UTC'))}</time>`
}
// The same format as stamp(), in the browser's timezone. Plain source (not stamp.toString()): bundlers may wrap functions.
const LOCAL_TIMES="(()=>{const parts=(d,o)=>Object.fromEntries(new Intl.DateTimeFormat('en-US',o).formatToParts(d).map(x=>[x.type,x.value])),day=d=>{const x=parts(d,{day:'numeric',month:'short'});return x.month+' '+x.day},time=d=>{const x=parts(d,{hour:'numeric',minute:'2-digit',hour12:true});return x.hour+':'+x.minute+' '+String(x.dayPeriod).toLowerCase()};"
 +"for(const el of document.querySelectorAll('[data-at]')){const a=new Date(el.dataset.at),u=el.dataset.until,show=el.dataset.show;let text;if(show==='date-year'){const x=parts(a,{day:'numeric',month:'short',year:'numeric'});text=x.month+' '+x.day+', '+x.year}else{text=show==='date'?day(a):day(a)+', '+time(a);if(u){const b=new Date(u);text+=' – '+(day(b)===day(a)?time(b):day(b)+', '+time(b))}if(show!=='date')text+=' '+parts(a,{timeZoneName:'short',hour:'numeric'}).timeZoneName}el.textContent=text}})()"
const digest=async(text:string)=>btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))))
let scriptHash:Promise<string>|undefined

export type Section='workshop'|'move-in'|'data'
const tabs:[Section|'settings',string,string][]=[['workshop','/app','Workshop'],['move-in','/app/move-in','Move in'],['data','/app/data','Data & access'],['settings','/auth/settings/identity','Sign-in settings']]

export async function page(title:string,body:string,actor?:Actor,status=200,section:Section='workshop') {
 scriptHash??=digest(LOCAL_TIMES)
 const nav=actor?`<nav class="tabs" aria-label="Main">${tabs.map(([id,href,label])=>`<a href="${href}"${id===section?' aria-current="page"':''}>${e(label)}</a>`).join('')}</nav>`:''
 const bar=`<header class="bar"><div class="bar-in"><a class="brand" href="/app"><img src="/brand/mark.svg" alt="" width="32" height="32"><span data-rer-name>Mallet</span></a>${actor?`<p class="who">${e(actor.name)} · ${e(actor.role)}</p>`:''}${nav}</div></header>`
 return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(title)} · Mallet</title><link rel="icon" href="/favicon.ico" sizes="32x32"><link rel="icon" type="image/svg+xml" href="/brand/favicon-32.svg"><link rel="preload" href="/fonts/sofia-sans/sofia-sans-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="/fonts/sofia-sans/sofia-sans-semi-condensed-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/rer-theme.css"><link rel="stylesheet" href="/brand/tokens.css"><link rel="stylesheet" href="/mallet.css"></head><body class="mallet">${bar}<main class="workshop"><header class="title"><p class="eyebrow">WORKSHOP REPAIR JOBS</p><h1>${e(title)}</h1></header>${body}</main><script>${LOCAL_TIMES}</script></body></html>`,{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'strict-origin','x-content-type-options':'nosniff','content-security-policy':`default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'; style-src 'self'; font-src 'self'; img-src 'self'; script-src 'sha256-${await scriptHash}'`}})
}
