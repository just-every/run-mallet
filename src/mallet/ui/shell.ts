// The app's frame on every screen: the left rail (car mark, sections, who is signed in), the top bar (today and
// New repair order) and the page heading. Visual authority: the owner-picked Shop Board (desk 17 Oct).
import type { Actor } from '../auth'
import {e,initials,when,LOCAL_TIMES} from './common'
import {ICONS,icon} from './icons'

export type Section='board'|'jobs'|'customers'|'approvals'|'move-in'|'data'
// Figures beside a section's name, when the page knows them.
export type Counts=Partial<Record<Section,number>>
export type Frame={section?:Section,counts?:Counts,subtitle?:string,aside?:string,heading?:boolean}

const sections:[Section|'settings',string,string,string][]=[
 ['board','/app','Board','board'],['jobs','/app/jobs','Repair orders','document'],['customers','/app/customers','Customers','people'],['approvals','/app/approvals','Approvals','check'],
 ['move-in','/app/move-in','Move in','box'],['data','/app/data','Data & access','key'],['settings','/auth/settings/identity','Sign-in settings','gear'],
]
const roles:Record<string,string>={owner:'Owner',admin:'Service advisor',member:'Technician',agent:'Agent'}

const digest=async(text:string)=>btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))))
let scriptHash:Promise<string>|undefined

function rail(actor:Actor,current:Section,counts:Counts) {
 const links=sections.map(([id,href,label,glyph])=>`<a href="${href}"${id===current?' aria-current="page"':''}>${icon(glyph)}<span>${e(label)}</span>${counts[id as Section]?`<span class="count">${counts[id as Section]}</span>`:''}</a>`).join('')
 return `<aside class="rail"><a class="brand" href="/app"><img src="/brand/mark.svg" alt="" width="40" height="40"><span data-rer-name>Mallet</span></a><nav class="navlinks" aria-label="Main">${links}</nav><div class="profile"><span class="avatar" aria-hidden="true">${e(initials(actor.name))}</span><p><strong>${e(actor.name)}</strong><span>${e(roles[actor.role]??actor.role)}</span></p></div></aside>`
}

export async function page(title:string,body:string,actor?:Actor,status=200,frame:Frame={}) {
 scriptHash??=digest(LOCAL_TIMES)
 const {section='board',counts={},subtitle='',aside='',heading=true}=frame
 const top=actor?`<header class="topbar"><p class="date">${when(new Date().toISOString(),undefined,'today')}</p>${actor.role==='member'?'':`<a class="button primary new" href="/app/customers#add">${icon('plus')}<span>New repair order</span></a>`}</header>`:''
 const head=heading?`<header class="heading"><h1>${e(title)}</h1>${subtitle?`<p>${subtitle}</p>`:''}</header>`:''
 const main=`<main class="main">${head}${body}</main>`
 const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(title)} · Mallet</title><link rel="icon" href="/favicon.ico" sizes="32x32"><link rel="icon" type="image/svg+xml" href="/brand/favicon-32.svg"><link rel="preload" href="/fonts/inter/inter-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="/fonts/inter-tight/inter-tight-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/site/tokens.css"><link rel="stylesheet" href="/app/shell.css"><link rel="stylesheet" href="/app/forms.css"><link rel="stylesheet" href="/app/board.css"></head>`
  +`<body class="app">${ICONS}<div class="shell${actor?'':' bare'}">${actor?rail(actor,section,counts):''}<div class="workspace">${top}${aside?`<div class="layout">${main}${aside}</div>`:main}</div></div><script>${LOCAL_TIMES}</script></body></html>`
 return new Response(html,{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'strict-origin','x-content-type-options':'nosniff','content-security-policy':`default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'; style-src 'self'; font-src 'self'; img-src 'self'; script-src 'sha256-${await scriptHash}'`}})
}
