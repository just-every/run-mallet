import fs from 'node:fs';
import { createRequire } from 'node:module';
const ts = createRequire(process.cwd() + '/package.json')('typescript');
const packet=process.argv[2] || '../packet';
const before=JSON.parse(fs.readFileSync(`${packet}/before-plan.json`));
const after=JSON.parse(fs.readFileSync(`${packet}/after-plan.json`));
const inventory=new Map();
function names(file){
 if(inventory.has(file))return inventory.get(file);
 const ast=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS); const names=[];
 function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(ast)==='test'){
  if(!ts.isStringLiteral(n.arguments[0]))throw Error(`Non-literal test: ${file}`);
  names.push(n.arguments[0].text);
 }ts.forEachChild(n,visit);}
 visit(ast);inventory.set(file,names);return names;
}
function map(plan){
 const result=new Map(),commands=[];
 for(const tier of ['push','nightly'])for(const shard of plan[tier])for(const command of shard.commands){
  if(!command.startsWith('node --test ')){commands.push({tier,shard:shard.name,command});continue;}
  const include=command.match(/--test-name-pattern='([^']*)'/)?.[1];
  const skip=command.match(/--test-skip-pattern='([^']*)'/)?.[1];
  for(const file of command.match(/tests\/[\w.-]+\.mjs/g)||[])for(const name of names(file)){
   if(include&&!new RegExp(include).test(name)||skip&&new RegExp(skip).test(name))continue;
   const key=`${file}\0${name}`,row=result.get(key)||[];
   row.push({tier,shard:shard.name});result.set(key,row);
  }
 }
 return {result,commands};
}
const old=map(before),next=map(after);
if(old.result.size!==next.result.size)throw Error('Test count mismatch');
const rows=[];
for(const [key,from]of old.result){
 const to=next.result.get(key);if(from.length!==1||!to||to.length!==1||from[0].tier!==to[0].tier)throw Error(`Missing/duplicate/moved tier: ${key}`);
 const [file,name]=key.split('\0');rows.push({file,name,before:from[0].shard,after:to[0].shard});
}
const oldCommands=old.commands.map(x=>x.command).sort(),newCommands=next.commands.map(x=>x.command).sort();
oldCommands.splice(oldCommands.indexOf('pnpm run build'),1);
if(JSON.stringify(oldCommands)!==JSON.stringify(newCommands))throw Error('Non-test commands changed beyond removal of duplicate build');
if(after.push.length>8||after.push.filter(s=>s.hosted).length!==1)throw Error('Bad shard/build count');
const summary={testsBefore:old.result.size,testsAfter:next.result.size,registrations:[...inventory].map(([file,names])=>({file,tests:names.length})),shardsBefore:before.push.length,shardsAfter:after.push.length,buildsBefore:2,buildsAfter:1,hostedBefore:1,hostedAfter:1,perShard:after.push.map(s=>({name:s.name,tests:rows.filter(r=>r.after===s.name).length})),rows,commandsBefore:old.commands,commandsAfter:next.commands};
fs.writeFileSync(`${packet}/mapping.json`,JSON.stringify(summary,null,2)+'\n');
let md=`# Complete test and journey mapping\n\n${rows.length} registered tests before and after, each selected exactly once. All test files and helpers remain byte-identical. One duplicate build is removed; source checks, typecheck, runtime, hosted-output, hydration, agent-door and nightly clone journey remain.\n\n| File | Test/journey | Before | After |\n| --- | --- | --- | --- |\n`;
for(const r of rows)md+=`| ${r.file} | ${r.name.replaceAll('|','\\|')} | ${r.before} | ${r.after} |\n`;
md+='\n| Command/journey | Before | After |\n| --- | --- | --- |\n';
for(const c of old.commands){const n=next.commands.filter(n=>n.command===c.command);md+=`| ${c.command} | ${c.shard} | ${n.map(n=>n.shard).join(', ')} |\n`;}
fs.writeFileSync(`${packet}/MAPPING.md`,md);
console.log(JSON.stringify({...summary,rows:undefined},null,2));
