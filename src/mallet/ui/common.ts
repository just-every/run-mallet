export const e=(v:unknown):string=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
export const money=(cents:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'AUD',currencyDisplay:'narrowSymbol'}).format((cents??0)/100)
export const hidden=(name:string,value:unknown)=>`<input type="hidden" name="${e(name)}" value="${e(value)}">`
export const field=(label:string,name:string,type='text',value:unknown='',extra='')=>`<label>${e(label)}<input name="${e(name)}" type="${type}" value="${e(value)}" ${extra}></label>`
export const select=(label:string,name:string,options:[string,string][],selected='')=>`<label>${e(label)}<select name="${e(name)}">${options.map(([value,text])=>`<option value="${e(value)}"${value===selected?' selected':''}>${e(text)}</option>`).join('')}</select></label>`
export const area=(label:string,name:string,value='',extra='')=>`<label>${e(label)}<textarea name="${e(name)}" ${extra}>${e(value)}</textarea></label>`
export const form=(command:string,content:string,button:string,values:Record<string,unknown>={},kind='')=>`<form method="post" action="/app/actions"${kind?` class="${kind}"`:''}>${hidden('command',command)}${Object.entries(values).map(([k,v])=>hidden(k,v)).join('')}${content}<button>${e(button)}</button></form>`
// A card: its title (with an optional status pill or step figure beside it) and content.
export const box=(title:string,content:string,{pill='',step='',extra='',id=''}:{pill?:string,step?:string|number,extra?:string,id?:string}={})=>`<section${id?` id="${e(id)}"`:''} class="card${extra?` ${extra}`:''}">${pill?'<div class="card-head">':''}<h2>${step!==''?`<span class="step">${e(step)}</span>`:''}${e(title)}</h2>${pill}${pill?'</div>':''}${content}</section>`
// Technicians are stored as operator IDs; show the operator's name (free text from older bookings is shown as typed, and an operator who is gone is not shown as an ID).
export type Names=Record<string,string>
export const person=(names:Names,id:unknown)=>names[String(id)]??(/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(String(id))?'Former team member':String(id??''))
export const initials=(name:string)=>name.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]!.toUpperCase()).join('')
// A status pill; its tone picks one of the board's chip colours (cyan selection, amber waiting, green done, violet working).
export type Tone=''|'cyan'|'amber'|'green'|'violet'|'red'
export const badge=(value:unknown,tone:Tone='')=>`<span class="pill${tone?` ${tone}`:''}">${e(value)}</span>`
export const tones:Record<string,Tone>={booked:'',working:'violet',completed:'green',invoiced:'',draft:'amber',approved:'cyan',sent:'amber',authorised:'green',exported:''}
const labels:Record<string,string>={booked:'Booked',working:'Working',completed:'Completed',invoiced:'Invoiced',draft:'Draft',approved:'Approved',sent:'Sent',authorised:'Authorized',exported:'Exported'}
export const status=(value:string)=>badge(labels[value]??value,tones[value]??'')
export const rows=(state:any,kind:string):any[]=>state.records[kind]??[]
// A list row whose whole area is one link; the chevron shows on phones.
export const linkRow=(href:string,title:string,meta:string,pill='')=>`<li><a class="row" href="${e(href)}"><span class="row-title"><span class="row-name">${e(title)}</span>${pill}</span><span class="row-meta">${meta}</span></a></li>`
export const join=(...parts:unknown[])=>parts.filter(part=>part!==undefined&&part!==null&&part!=='').map(e).join(' · ')

// Times are stored as UTC ISO strings and shown in the browser's own timezone: the script below rewrites each [data-at]
// with the same formats; without JavaScript the server's UTC rendering stays. Formats:
// time "Oct 19, 9:00 am – 10:00 am EDT" · date "Oct 19" · date-year "Oct 19, 2026" · clock "9:12 am" ·
// short "9:12 am" today, "Tue 10:30 am" within the week, else "Oct 27, 8:00 am" · today "Mon Oct 19, 2026 · 9:41 am".
export type Show='time'|'date'|'date-year'|'clock'|'short'|'today'
const stamp=(at:string,until:string|undefined,show:string,timeZone:string,now:Date)=>{
 const parts=(d:Date,o:Intl.DateTimeFormatOptions)=>Object.fromEntries(new Intl.DateTimeFormat('en-US',{...o,timeZone}).formatToParts(d).map(x=>[x.type,x.value]))
 const day=(d:Date)=>{const x=parts(d,{day:'numeric',month:'short',year:'numeric'});return x.month+' '+x.day}
 const year=(d:Date)=>parts(d,{year:'numeric'}).year
 const time=(d:Date)=>{const x=parts(d,{hour:'numeric',minute:'2-digit',hour12:true});return x.hour+':'+x.minute+' '+String(x.dayPeriod).toLowerCase()}
 const a=new Date(at),zone=()=>' '+parts(a,{timeZoneName:'short',hour:'numeric'}).timeZoneName
 if(show==='date-year')return day(a)+', '+year(a)
 if(show==='date')return day(a)
 if(show==='clock')return time(a)
 if(show==='today'){const x=parts(a,{weekday:'short'});return x.weekday+' '+day(a)+', '+year(a)+' · '+time(a)}
 if(show==='short'){if(day(a)===day(now)&&year(a)===year(now))return time(a);if(Math.abs(a.getTime()-now.getTime())<6*864e5)return parts(a,{weekday:'short'}).weekday+' '+time(a);return day(a)+', '+time(a)}
 let text=day(a)+', '+time(a)
 if(until){const b=new Date(until);text+=' – '+(day(b)===day(a)?time(b):day(b)+', '+time(b))}
 return text+zone()
}
export function when(at:unknown,until?:unknown,show:Show='time') {
 if(typeof at!=='string'||!Number.isFinite(Date.parse(at)))return e(at)
 const end=typeof until==='string'&&Number.isFinite(Date.parse(until))?until:undefined
 return `<time datetime="${e(at)}" title="${e(end?`${at} – ${end}`:at)}" data-at="${e(at)}"${end?` data-until="${e(end)}"`:''} data-show="${show}">${e(stamp(at,end,show,'UTC',new Date()))}</time>`
}
// The same formats as stamp(), in the browser's timezone. Plain source (not stamp.toString()): bundlers may wrap functions.
export const LOCAL_TIMES="(()=>{const now=new Date(),parts=(d,o)=>Object.fromEntries(new Intl.DateTimeFormat('en-US',o).formatToParts(d).map(x=>[x.type,x.value])),day=d=>{const x=parts(d,{day:'numeric',month:'short'});return x.month+' '+x.day},year=d=>parts(d,{year:'numeric'}).year,time=d=>{const x=parts(d,{hour:'numeric',minute:'2-digit',hour12:true});return x.hour+':'+x.minute+' '+String(x.dayPeriod).toLowerCase()};"
 +"for(const el of document.querySelectorAll('[data-at]')){const a=new Date(el.dataset.at),u=el.dataset.until,show=el.dataset.show;let text;"
 +"if(show==='date-year')text=day(a)+', '+year(a);else if(show==='date')text=day(a);else if(show==='clock')text=time(a);"
 +"else if(show==='today')text=parts(a,{weekday:'short'}).weekday+' '+day(a)+', '+year(a)+' · '+time(a);"
 +"else if(show==='short')text=day(a)===day(now)&&year(a)===year(now)?time(a):Math.abs(a-now)<6*864e5?parts(a,{weekday:'short'}).weekday+' '+time(a):day(a)+', '+time(a);"
 +"else{text=day(a)+', '+time(a);if(u){const b=new Date(u);text+=' – '+(day(b)===day(a)?time(b):day(b)+', '+time(b))}text+=' '+parts(a,{timeZoneName:'short',hour:'numeric'}).timeZoneName}"
 +"el.textContent=text}})()"
