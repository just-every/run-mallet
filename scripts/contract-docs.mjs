import fs from 'node:fs'
import {parseContract} from '../src/base/seed-contract.mjs'

const mode=process.argv[2]
if(!['write','check'].includes(mode))throw Error('Usage: node scripts/contract-docs.mjs write|check')
const original=fs.readFileSync('CONTRACT.md','utf8')
const status=original.indexOf('\n## Status\n')
if(status<0)throw Error('Missing contract Status section')
const before=original.slice(0,status),tail=original.slice(status)
const rows=[...tail.matchAll(/^\| `[^`]+` \| [^|]+ \| (published|target|push-further) \| (done|partial|missing) \|/gm)]
const count=kinds=>{const selected=rows.filter(r=>kinds.includes(r[1]));return ['done','partial','missing'].map(s=>selected.filter(r=>r[2]===s).length).concat(selected.length)}
const summary=new Map([['Published',count(['published'])],['Target and push further',count(['target','push-further'])],['All',count(['published','target','push-further'])]])
const source=before+tail.replace(/^\| (Published|Target and push further|All) \|.*$/gm,(_,name)=>'| '+name+' | '+summary.get(name).join(' | ')+' |')
const contract=parseContract(source)
const lines=['# Mallet target acceptance','','Generated from CONTRACT.md by `node scripts/contract-docs.mjs write`. The contract owns the full target, acceptance sentences, riders and remaining gaps. This index links each clause to that source and its current proof.','']
for(const area of contract.areas){
 lines.push('## '+area.name,'')
 for(const id of area.clauses){
  const clause=contract.clauses.find(c=>c.id===id)
  lines.push('**'+clause.id+' — '+clause.title+'.** Status: **'+clause.status+'**. [Target, acceptance and remaining work](./CONTRACT.md#'+area.slug+').','')
  lines.push('Evidence: '+(clause.evidence.length?clause.evidence.map(path=>'`'+path+'`').join('; '):'No implementation evidence yet')+'.','')
 }
}
const claims=source.match(/^## Homepage claims\n([\s\S]*?)(?=^## Status\n)/m)
if(!claims)throw Error('Missing contract claims')
const claimRows=[...claims[1].matchAll(/^\| (\d+) \| [^|]+ \| [^|]+ \| ([^|]+) \| (done|partial|missing) \|/gm)]
const claimLines=['# Mallet claims','','Generated from CONTRACT.md by `node scripts/contract-docs.mjs write`. [Exact claim wording and scope](../CONTRACT.md#homepage-claims) remain in the contract source.','','| Claim row | Clauses | Status |','| --- | --- | --- |',...claimRows.map(r=>'| '+r[1]+' | '+r[2].trim()+' | '+r[3]+' |'),'']
const outputs=new Map([['CONTRACT.md',source],['ACCEPTANCE.md',lines.join('\n')],['docs/CLAIMS.md',claimLines.join('\n')]])

for(const [path,value] of outputs){
 if(mode==='write')fs.writeFileSync(path,value)
 else if(!fs.existsSync(path)||fs.readFileSync(path,'utf8')!==value)throw Error('Stale contract document: '+path+'; run node scripts/contract-docs.mjs write')
}
console.log('Contract documents '+(mode==='write'?'generated':'checked')+': '+contract.counts.done+' done, '+contract.counts.partial+' partial, '+contract.counts.missing+' missing')
