// Incremental projection for legacy acceptance entries while retaining unrelated clauses.
import {readFile,writeFile} from 'node:fs/promises'
import {parseContract} from '../src/base/seed-contract.mjs'
const [mode,id]=process.argv.slice(2)
if(!['write','check'].includes(mode)||!/^STORE-002$/.test(id??''))throw Error('Usage: node scripts/contract-docs.mjs write|check STORE-002')
let source=await readFile('CONTRACT.md','utf8')
const entries=source.split('\n').filter(line=>/^\| `[A-Z]/.test(line)).map(line=>{const cells=line.split(' | ').map(c=>c.trim());return [line,cells[0].slice(3,-1),cells[1],cells[2],cells[3],cells[4],cells.slice(5).join(' | ').replace(/\s*\|$/, '').trim()]})
const count=list=>['done','partial','missing'].map(s=>list.filter(r=>r[4]===s).length)
for(const [label,list] of [['Published',entries.filter(r=>r[3]==='published')],['Target and push further',entries.filter(r=>r[3]!=='published')],['All',entries]])source=source.replace(new RegExp('^\\| '+label+' \\|.*$','m'),'| '+label+' | '+count(list).join(' | ')+' | '+list.length+' |')
const parsed=parseContract(source),clause=parsed.clauses.find(c=>c.id===id),entry=entries.find(r=>r[1]===id)
if(!clause||!entry)throw Error('Unknown clause')
const definition=source.split('\n')[clause.line-1],journey=definition.split('**Acceptance evidence:** ')[1]
if(!journey)throw Error('The clause needs its existing acceptance journey')
const projection=`**${id} — ${clause.title}.** Status: **${clause.status}**. ${journey} Evidence: ${entry[5]}${clause.gap?' Gap: '+clause.gap:''} New product data inherits OPS-001 before shipping.`
const acceptance=await readFile('ACCEPTANCE.md','utf8'),projected=acceptance.replace(new RegExp('^\\*\\*'+id+' — [^\\n]+$','m'),projection)
if(projected===acceptance&&!acceptance.includes(projection))throw Error('Acceptance entry not found')
const claims='# Contract status register\n\nGenerated from CONTRACT.md by the contract docs command. Acceptance wording remains in CONTRACT.md.\n\n| Clause | Status |\n| --- | --- |\n'+parsed.clauses.map(c=>`| ${c.id} | ${c.status} |`).join('\n')+'\n'
for(const [path,expected]of [['CONTRACT.md',source],['ACCEPTANCE.md',projected],['docs/CLAIMS.md',claims]]){
 if(mode==='write')await writeFile(path,expected)
 else if(await readFile(path,'utf8').catch(()=>null)!==expected)throw Error(path+' needs contract docs write')
}
console.log('Contract docs '+mode+': '+id+'; '+JSON.stringify(parsed.counts))
