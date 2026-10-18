// The app's line icons, drawn once per page as an inline sprite (the page's CSP allows no external SVG use) and
// referenced by id. Strokes take currentColor, so each icon wears its link's colour.
const symbols:Record<string,string>={
 board:'<rect x="3" y="3" width="7" height="18" rx="2" fill="currentColor" stroke="none"/><rect x="14" y="5" width="7" height="16" rx="2" fill="currentColor" stroke="none"/>',
 document:'<rect x="4" y="2.5" width="16" height="19" rx="2"/><path d="M8 7.5h8M8 11.5h8M8 15.5h5"/>',
 people:'<circle cx="9.5" cy="7" r="3.5"/><path d="M2.5 20.5v-1.5c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5v1.5M16 3.8a3.4 3.4 0 0 1 0 6.4M18.5 14c2 .7 3 2.2 3 4.5v2"/>',
 check:'<circle cx="12" cy="12" r="9.5"/><path d="m7.8 12.3 2.8 2.8 5.6-5.8"/>',
 box:'<path d="m12 2.5 9 4.5v10l-9 4.5-9-4.5V7Zm0 9 9-4.5M3 7l9 4.5v10M7.5 4.8l9 4.5"/>',
 key:'<circle cx="8" cy="15" r="4.5"/><path d="m11.2 11.8 9.3-9.3M16.5 6.5l3 3M14 9l2 2"/>',
 gear:'<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 spark:'<path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5M5.3 5.3l3.2 3.2M15.5 15.5l3.2 3.2M5.3 18.7l3.2-3.2M15.5 8.5l3.2-3.2"/>',
 clock:'<circle cx="12" cy="12" r="9.5"/><path d="M12 6.5V12l3.8 2.3"/>',
 car:'<path d="M4.5 11 7 5.5h10l2.5 5.5 2 1.8V19h-3.5v-2h-12v2H2.5v-6.2Z"/><path d="M6.5 11h11M6.5 14.3h1.5M16 14.3h1.5"/>',
 mail:'<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>',
 alert:'<path d="M12 3 2.5 20h19Z"/><path d="M12 10v4.5M12 17.2v.3"/>',
 percent:'<circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/><path d="M19 5 5 19"/>',
 close:'<path d="M6 6l12 12M18 6 6 18"/>',
}
export const ICONS=`<svg class="sprite" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><defs>${Object.entries(symbols).map(([id,body])=>`<symbol id="i-${id}" viewBox="0 0 24 24">${body}</symbol>`).join('')}</defs></svg>`
export const icon=(id:string,extra='')=>`<svg class="icon${extra?` ${extra}`:''}" aria-hidden="true"><use href="#i-${id}"/></svg>`
