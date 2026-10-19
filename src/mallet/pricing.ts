import {bump,choice,event,expectVersion,fail,find,integer,object,put,text,who,type Context,type Handler} from './model'

export const pricingCommands = ['pricing.save'] as const
export type PricingBand = {fromCents:number;toCents:number|null;markupBps:number}
export type PricingOverride = {unitCents:number;reason:string}
export type RecipePricingInput = {overrides?:Array<PricingOverride & {lineIndex:number}>}
const MAX_CENTS = 1_000_000_000

function manager(c:Context) {
 if(!['owner','admin'].includes(c.actor.role))fail('FORBIDDEN','Only an owner or administrator may configure pricing or override calculated prices.',null,403)
}

function bands(value:unknown):PricingBand[] {
 if(!Array.isArray(value)||!value.length||value.length>100)fail('INPUT','Provide 1–100 contiguous pricing bands.',null,400)
 let next=0
 return value.map((raw,index)=>{
  const p=object(raw,'pricing band'),fromCents=integer(p.fromCents,'fromCents'),last=index===value.length-1
  if(fromCents!==next)fail('INPUT','Pricing bands must start at zero and meet without gaps or overlaps.',null,400)
  if(last&&p.toCents!==null||!last&&p.toCents===null)fail('INPUT','Only the final pricing band must have an unbounded null upper limit.',null,400)
  const toCents=last?null:integer(p.toCents,'toCents',fromCents+1)
  next=toCents??next
  return {fromCents,toCents,markupBps:integer(p.markupBps,'markupBps',0,1_000_000)}
 })
}

export const pricing:Handler=(c,command,p)=>{
 if(command!=='pricing.save')return
 manager(c)
 const existing=p.id===undefined?null:find(c.s,'pricingMatrix',p.id)
 if(existing)expectVersion(existing,p.version)
 else if(integer(p.version,'version',0)!==0)fail('VERSION','New pricing matrices require version zero.')
 const kind=choice(p.kind,['part','labor'],'pricing matrix kind')
 if(existing&&existing.revisions.at(-1).kind!==kind)fail('INPUT','A pricing matrix keeps its original part or labor kind.',null,400)
 const revision={n:existing?existing.revisions.at(-1).n+1:1,name:text(p.name,'pricing matrix name'),kind,bands:bands(p.bands),minimumCents:integer(p.minimumCents,'minimumCents'),roundingCents:integer(p.roundingCents,'roundingCents',1),reason:text(p.reason,'pricing revision reason',2000),at:c.now,by:who(c)}
 const saved=existing?bump(c.s,'pricingMatrix',existing,{revisions:[...existing.revisions,revision]}):put(c.s,'pricingMatrix',{createdAt:c.now,revisions:[revision]})
 event(c,command,null,saved.id,revision)
 return saved
}

function safeCents(value:bigint):number {
 if(value<0n||value>BigInt(MAX_CENTS))fail('MONEY','The calculated unit price exceeds the supported cent amount.',null,400)
 return Number(value)
}

/** Calculates current rules once; callers retain provenance with the immutable estimate revision. */
export function priceRecipe(c:Context,input:unknown,p:RecipePricingInput={}) {
 if(!Array.isArray(input)||!input.length||input.length>100)fail('INPUT','Provide 1–100 service recipe lines.',null,400)
 const options=object(p,'recipe pricing options'),overrides=new Map<number,PricingOverride>()
 if(options.overrides!==undefined) {
  if(!Array.isArray(options.overrides)||options.overrides.length>input.length)fail('INPUT','Provide at most one price override per recipe line.',null,400)
  for(const raw of options.overrides) {
   const entry=object(raw,'price override'),index=integer(entry.lineIndex,'override lineIndex',0,input.length-1)
   if(overrides.has(index))fail('INPUT','A recipe line may have only one price override.',null,400)
   overrides.set(index,{unitCents:integer(entry.unitCents,'override unitCents'),reason:text(entry.reason,'price override reason',2000)})
  }
 }
 const provenance:any[]=[]
 const lines=input.map((raw,index)=>{
  const line=object(raw,'service recipe line'),hasCost=line.costCents!==undefined,hasMatrix=line.matrixId!==undefined
  const suppliedOverride=overrides.get(index)
  if(suppliedOverride&&line.override!==undefined)fail('INPUT','Choose one override source per recipe line.',null,400)
  const overrideInput=suppliedOverride??line.override
  if(hasCost!==hasMatrix)fail('INPUT','Cost pricing requires both costCents and matrixId.',null,400)
  if(!hasMatrix) {
   if(overrideInput!==undefined)fail('INPUT','Price overrides require a calculated matrix price.',null,400)
   provenance.push(null)
   return structuredClone(line)
  }
  const costCents=integer(line.costCents,'costCents'),matrix=find(c.s,'pricingMatrix',line.matrixId),revision=matrix.revisions.at(-1)
  if(!revision)fail('PRICING','That pricing matrix has no revision.')
  const kind=choice(line.kind,['part','labor'],'line kind')
  if(revision.kind!==kind)fail('PRICING','Choose a pricing matrix matching this line’s part or labor kind.')
  const bandIndex=revision.bands.findIndex((band:PricingBand)=>costCents>=band.fromCents&&(band.toCents===null||costCents<band.toCents))
  if(bandIndex<0)fail('PRICING','No pricing band covers this cost.')
  const band:PricingBand=revision.bands[bandIndex]
  const marked=(BigInt(costCents)*(10000n+BigInt(band.markupBps))+5000n)/10000n
  const increment=BigInt(revision.roundingCents),rounded=((marked+increment-1n)/increment)*increment
  const calculatedCents=safeCents(rounded>BigInt(revision.minimumCents)?rounded:BigInt(revision.minimumCents))
  let override:null|Record<string,unknown>=null,unitCents=calculatedCents
  if(overrideInput!==undefined) {
   manager(c)
   const requested=object(overrideInput,'price override')
   unitCents=integer(requested.unitCents,'override unitCents')
   override={unitCents,reason:text(requested.reason,'price override reason',2000),by:who(c),at:c.now}
  }
  const evidence={lineIndex:index,kind,costCents,matrix:{id:matrix.id,version:matrix.version,revision:revision.n,snapshot:structuredClone(revision)},bandIndex,markedCents:safeCents(marked),roundedCents:safeCents(rounded),calculatedCents,unitCents,override,pricedAt:c.now,pricedBy:who(c)}
  provenance.push(evidence)
  const {override:unused,...retained}=structuredClone(line)
  return {...retained,unitCents}
 })
 return {lines,provenance}
}
