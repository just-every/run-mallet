import assert from 'node:assert/strict'
import {spawn,execFileSync} from 'node:child_process'
import {mkdtemp,readFile,rm,mkdir} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {browserJourney} from './browser-journey.mjs'
import {portableRepair,publicDoor} from './support/portable-repair.mjs'
import {openSourceInstallation,publishedStartSite} from './open-source-journey.mjs'

await publishedStartSite(process.cwd())

const directory=await mkdtemp(join(tmpdir(),'mallet-published-')),scratchHome=join(directory,'home')
await mkdir(scratchHome,{mode:0o700})
const command=JSON.parse(await readFile('src/site/run.json','utf8')).clone.split(/\s+/)
let log='',launcher
// The CLI uses an isolated HOME; this browser-driving Node process retains the real HOME.
const stopOwned=async()=>{
 const servers=[...log.matchAll(/background \(PID (\d+)\)/g)].map(m=>Number(m[1])),roots=new Set([launcher?.pid,...servers].filter(Number.isInteger))
 const processes=execFileSync('ps',['-eo','pid=,ppid='],{encoding:'utf8'}).trim().split('\n').map(line=>line.trim().split(/\s+/).map(Number))
 let more=true;while(more){more=false;for(const [pid,parent] of processes)if(roots.has(parent)&&!roots.has(pid)){roots.add(pid);more=true}}
 // These are exclusively the launch's recorded PID and its descendants, never a name match.
 for(const pid of [...roots].reverse())try{process.kill(pid,'SIGTERM')}catch(error){if(error.code!=='ESRCH')throw error}
 const alive=()=>[...roots].filter(pid=>{try{process.kill(pid,0);return true}catch(error){if(error.code!=='ESRCH')throw error;return false}})
 // Shutdown flushes Worker state. Wait for the launch to exit before removing its files.
 const deadline=Date.now()+5000
 while(alive().length&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,50))
 for(const pid of alive())try{process.kill(pid,'SIGKILL')}catch(error){if(error.code!=='ESRCH')throw error}
 const killedDeadline=Date.now()+1000
 while(alive().length&&Date.now()<killedDeadline)await new Promise(resolve=>setTimeout(resolve,50))
 assert.equal(alive().length,0,'OPEN-001: all owned launch processes stopped before cleanup')
}
try {
 await new Promise((resolve,reject)=>{
  launcher=spawn(command[0],command.slice(1),{cwd:directory,env:{...process.env,HOME:scratchHome,RER_BROWSER:'none'},stdio:['ignore','pipe','pipe']})
  const timer=setTimeout(()=>{stopOwned().then(()=>reject(Error('OPEN-001: published command did not finish within ten minutes; private log withheld.'))).catch(reject)},600000)
  launcher.stdout.on('data',x=>{log+=x});launcher.stderr.on('data',x=>{log+=x})
  launcher.on('error',error=>{clearTimeout(timer);reject(error)});launcher.on('exit',code=>{clearTimeout(timer);code===0?resolve():reject(Error(`OPEN-001: published command failed (exit ${code}); private log withheld.`))})
 })
 const checkout=join(directory,JSON.parse(await readFile('src/site/run.json','utf8')).folder)
 const paywall=await openSourceInstallation(checkout),open=await readFile(join(checkout,'.rer/local/open-url'),'utf8')
 const source=await browserJourney(open.trim(),{directory:process.env.MALLET_SCREENSHOTS??'.cache/clone-browser',fixtures:join(checkout,'tests/fixtures/repairshopr'),fresh:true,paywall})
 await portableRepair(publicDoor(source.origin,source.cookie))
 console.log('OPS-001: fresh published-command installation exported full repair history; an empty separately owned installation restored exact records, refused old authority and finished the repair.')
 console.log('OPEN-001: published npx command reached empty-shop setup; installed MIT source and every exercised app screen have no Mallet commercial gate.')
}finally{await stopOwned();await rm(directory,{recursive:true,force:true})}
