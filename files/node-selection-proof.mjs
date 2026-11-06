import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
const ts=createRequire(process.cwd()+'/package.json')('typescript');
const packet=process.argv[2]||'../packet';
const plans=['before','after'].map(name=>[name,JSON.parse(fs.readFileSync(`${packet}/${name}-plan.json`))]);
const names=[],byFile=new Map();
for(const [,plan]of plans)for(const shard of plan.push)for(const command of shard.commands){
 if(!command.startsWith('node --test '))continue;
 for(const file of command.match(/tests\/[\w.-]+\.mjs/g)||[]){
  if(byFile.has(file))continue;
  const ast=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);const ids=[];
  function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(ast)==='test'){
   if(!ts.isStringLiteral(n.arguments[0]))throw Error('Non-literal test name');
   ids.push(names.length);names.push({file,name:n.arguments[0].text});
  }ts.forEachChild(n,visit);}visit(ast);byFile.set(file,ids);
 }
}
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'mallet-node-select-'));let records={};
try{
 for(const [file,ids]of byFile){const target=path.join(temporary,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,"import {test} from 'node:test';\n"+ids.map(id=>`test(${JSON.stringify(names[id].name)},()=>console.log('SELECT=${id}'));`).join('\n')+'\n');}
 for(const [label,plan]of plans){
  const seen=new Map(),commands=[];
  for(const shard of plan.push)for(const command of shard.commands){
   if(!command.startsWith('node --test '))continue;
   const result=spawnSync('/bin/bash',['-euo','pipefail','-c',command.replace('node --test ','node --test --test-reporter=tap ')],{cwd:temporary,encoding:'utf8',env:process.env,maxBuffer:16*1024*1024});
   if(result.status!==0)throw Error(`Node selector probe failed: ${shard.name}: ${result.stderr}`);
   const selected=[...result.stdout.matchAll(/^# SELECT=(\d+)$/gm)].map(m=>Number(m[1]));
   for(const id of selected){const own=seen.get(id)||[];own.push(shard.name);seen.set(id,own);}
   commands.push({shard:shard.name,command,selected:selected.map(id=>names[id])});
  }
  for(let id=0;id<names.length;id++)if(seen.get(id)?.length!==1)throw Error(`${label}: ${names[id].name} selected ${seen.get(id)?.length||0} times`);
  records[label]={tests:seen.size,commands};
 }
 const receipt={node:process.version,kind:'Actual Node CLI selection using no-op copies of all literal test registrations; application assertions run separately',tests_before:records.before.tests,tests_after:records.after.tests,exactly_once:true,records};
 fs.writeFileSync(`${packet}/NODE-SELECTION-RECEIPT.json`,JSON.stringify(receipt,null,2)+'\n');
 console.log(`Actual Node runner selection: ${records.before.tests} before / ${records.after.tests} after, each exactly once.`);
}finally{fs.rmSync(temporary,{recursive:true,force:true});}
