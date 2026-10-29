import {builtinModules} from 'node:module'
import {build} from 'esbuild'

const builtins=new Set(builtinModules.map(name=>name.replace(/^node:/,'')))

// Mirror the production Worker's native Node compatibility for CommonJS packages.
// Dependencies stay bundled; built-in calls use workerd's actual implementations.
export function workerBundle(entry,clock){
 if(clock&&!Number.isFinite(Date.parse(clock)))throw Error("Invalid test clock")
 const clockScript=clock?`const TestDate=globalThis.Date;globalThis.Date=class extends TestDate{constructor(...args){if(args.length)super(...args);else super(${Date.parse(clock)})}static now(){return ${Date.parse(clock)}}};`:""
 return build({entryPoints:[entry],bundle:true,write:false,format:'esm',platform:'neutral',mainFields:['module','main'],target:'es2022',external:['node:*','cloudflare:*'],banner:{js:"import {createRequire as workerCreateRequire} from 'node:module';const require=workerCreateRequire('/bundle/mallet-worker.mjs');"+clockScript},plugins:[{name:'worker-node-builtins',setup(plugin){plugin.onResolve({filter:/^[a-z][a-z0-9_]*(?:\/[a-z0-9_]+)?$/},args=>builtins.has(args.path)?{path:'node:'+args.path,external:true}:undefined)}}]})
}
