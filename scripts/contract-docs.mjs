// Compatibility projection for this edition's legacy contract layout. Keep
// untouched acceptance history intact while regenerating a selected clause.
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {parseContract} from '../src/base/seed-contract.mjs'

const [mode,flag,id]=process.argv.slice(2)
if(!['write','check'].includes(mode)||flag!=='--clause'||!id)throw Error('Usage: contract-docs.mjs write|check --clause ID')
let source=await readFile('CONTRACT.md','utf8')
const statusRows=[...source.matchAll(/^\| `([^`]+)` \| (.*?) \| (published|target|push-further) \| (done|partial|missing) \| (.*?) \| ?(.*?) ?\|$/gm)]
const selected=statusRows.find(row=>row[1]===id)
if(!selected)throw Error('No clause status row for '+id)
const count=kinds=>{const own=statusRows.filter(row=>kinds.includes(row[3]));return [own.filter(row=>row[4]==='done').length,own.filter(row=>row[4]==='partial').length,own.filter(row=>row[4]==='missing').length,own.length]}
for(const [label,kinds] of [['Published',['published']],['Target and push further',['target','push-further']],['All',['published','target','push-further']]]){
 source=source.replace(new RegExp('^\\| '+label+' \\|.*$','m'),'| '+label+' | '+count(kinds).join(' | ')+' |')
}
const contract=parseContract(source),clause=contract.clauses.find(row=>row.id===id)
const acceptance=clause.text.split('**Acceptance evidence:**')[1]?.trim()
if(!acceptance)throw Error('No acceptance evidence sentence for '+id)
const entry=`**${id} — ${clause.title}.** Status: **${clause.status}**. ${acceptance}${selected[5]?' Evidence: '+selected[5]:''}${selected[6]?' Gap: '+selected[6]:''}`
const previous=await readFile('ACCEPTANCE.md','utf8'),pattern=new RegExp('^\\*\\*'+id+' — .*$', 'm')
if(!pattern.test(previous))throw Error('No legacy acceptance entry for '+id)
const projected=previous.replace(pattern,()=>entry)
const claimStart=source.indexOf('| # |'),claimEnd=source.indexOf('\n## Status')
if(claimStart<0||claimEnd<claimStart)throw Error('No homepage claim mapping')
const claims='# Mallet capability claim mapping\n\nGenerated from CONTRACT.md.\n\n'+source.slice(claimStart,claimEnd).trim()+'\n'
const outputs=[['CONTRACT.md',source],['ACCEPTANCE.md',projected],['docs/CLAIMS.md',claims]]
for(const [path,expected] of outputs){
 if(mode==='write'){await mkdir('docs',{recursive:true});await writeFile(path,expected)}
 else if(await readFile(path,'utf8')!==expected)throw Error('Stale contract projection: '+path)
}
console.log('Contract projections '+mode+' passed for '+id+'; '+JSON.stringify(contract.counts))
