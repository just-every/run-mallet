import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {parseContract} from '../src/base/seed-contract.mjs'

// Synchronize selected legacy acceptance paragraphs without rewriting other campaigns' prose.
const [mode,...ids]=process.argv.slice(2)
if(!['write','check'].includes(mode)||!ids.length)throw Error('Usage: contract-docs.mjs write|check CLAUSE...')
const source=readFileSync('CONTRACT.md','utf8'),lines=source.split('\n'),contract=parseContract(source)
let acceptance=readFileSync('ACCEPTANCE.md','utf8')
for(const id of ids){
 const clause=contract.clauses.find(c=>c.id===id);if(!clause)throw Error('Unknown clause: '+id)
 const cells=lines[clause.row-1].trim().replace(/^\||\|$/g,'').split(/(?<!\\)\|/).map(cell=>cell.trim().replace(/\\\|/g,'|'))
 const evidence=clause.text.split('**Acceptance evidence:**')[1]?.trim();if(!evidence)throw Error('Missing acceptance evidence: '+id)
 const duty=clause.text.includes('New product data inherits OPS-001 before shipping.')?' New product data inherits OPS-001 before shipping.':''
 const paragraph=`**${id} — ${clause.title}.** Status: **${clause.status}**. ${evidence}${cells[4]?' Evidence: '+cells[4]+(/[.!?]$/.test(cells[4])?'':'.'):''}${cells[5]?' Gap: '+cells[5]:''}${duty}`
 const pattern=new RegExp('^\\*\\*'+id+' — .+$','m')
 if(!pattern.test(acceptance))throw Error('Missing acceptance paragraph: '+id)
 acceptance=acceptance.replace(pattern,()=>paragraph)
}
const claimStart=source.indexOf('## Homepage claims\n'),claimEnd=source.indexOf('\n## ',claimStart+1)
if(claimStart<0)throw Error('Missing contract claim map')
const claims='# Contract claim map\n\nGenerated from CONTRACT.md.\n\n'+source.slice(claimStart,claimEnd<0?source.length:claimEnd).trim()+'\n'
for(const [path,value] of [['ACCEPTANCE.md',acceptance],['docs/CLAIMS.md',claims]]){
 if(mode==='write'){mkdirSync(path.includes('/')?path.slice(0,path.lastIndexOf('/')):'.',{recursive:true});writeFileSync(path,value)}
 else if(readFileSync(path,'utf8')!==value)throw Error('Stale generated document: '+path)
}
console.log('Contract documents '+mode+': '+ids.join(', '))
