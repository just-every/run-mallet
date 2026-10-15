import { fontHead } from '../../base/font-head'
import { themeFrame } from '../../base/theme-frame'
import branding from '../../branding.json'
import type { Actor } from '../auth'
export const e=(v:unknown):string=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
export const money=(cents:number)=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format((cents??0)/100)
export const hidden=(name:string,value:unknown)=>`<input type="hidden" name="${e(name)}" value="${e(value)}">`
export const field=(label:string,name:string,type='text',value:unknown='',extra='')=>`<label>${e(label)}<input name="${e(name)}" type="${type}" value="${e(value)}" ${extra}></label>`
export const area=(label:string,name:string,value='',extra='')=>`<label>${e(label)}<textarea name="${e(name)}" ${extra}>${e(value)}</textarea></label>`
export const form=(command:string,content:string,button:string,values:Record<string,unknown>={})=>`<form method="post" action="/app/actions">${hidden('command',command)}${Object.entries(values).map(([k,v])=>hidden(k,v)).join('')}${content}<button>${e(button)}</button></form>`
export const box=(title:string,content:string)=>`<section class="card"><h2>${e(title)}</h2>${content}</section>`
export const badge=(value:unknown)=>`<span class="badge">${e(value)}</span>`
export const rows=(state:any,kind:string):any[]=>state.records[kind]??[]
export async function page(title:string,body:string,actor?:Actor,status=200) {
 const frame=await themeFrame({href:'/rer-theme.css',productName:branding.name,accentColor:branding.primaryColor})
 return new Response(`<!doctype html><html lang="en"${frame.htmlClass}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(title)} · Mallet</title>${fontHead}${frame.head}<link rel="stylesheet" href="/mallet.css"></head><body><main class="workshop">${frame.brand}<header><div><p class="eyebrow">WORKSHOP REPAIR JOBS</p><h1>${e(title)}</h1></div>${actor?`<p>${e(actor.name)} · ${e(actor.role)}</p>`:''}</header>${actor?'<nav aria-label="Main"><a href="/app">Workshop</a><a href="/app/move-in">Move in</a><a href="/app/data">Data & access</a><a href="/auth/settings/identity">Sign-in settings</a></nav>':''}${body}</main></body></html>`,{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'strict-origin','x-content-type-options':'nosniff','content-security-policy':`default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'; ${frame.policy}`}})
}
