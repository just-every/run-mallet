#!/usr/bin/env node
import { createReadStream, createWriteStream } from 'node:fs'
import { writeFile, unlink } from 'node:fs/promises'
import { once } from 'node:events'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { readEmptyTemplate, capacityArchive } from './archive.mjs'

export async function generateFile({template,output,scale='smoke',shops=1}){
 if(resolve(template)===resolve(output))throw new Error('Output must differ from the native template.')
 const archive=await capacityArchive(await readEmptyTemplate(createReadStream(template)),{scale,shops})
 const stream=createWriteStream(output,{flags:'wx',mode:0o600})
 let opened=false,writeError;stream.on('error',error=>{writeError=error})
 try{
  await once(stream,'open');opened=true
  for await(const line of archive.lines()){
   if(writeError)throw writeError
   if(!stream.write(JSON.stringify(line)+'\n'))await once(stream,'drain')
  }
  stream.end();await once(stream,'finish')
  await writeFile(output+'.report.json',JSON.stringify({...archive.report,partCount:archive.manifest.partCount},null,2)+'\n',{flag:'wx',mode:0o600})
  return archive.report
 }catch(error){stream.destroy();if(opened)await unlink(output).catch(()=>{});throw error}
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href){
 const args=process.argv.slice(2),options={}
 for(let i=0;i<args.length;i+=2){const flag=args[i],value=args[i+1];if(!['--template','--output','--scale','--shops'].includes(flag)||value===undefined)throw new Error('Usage: node scripts/capacity/generate.mjs --template EMPTY.rer --output SYNTHETIC.rer [--scale smoke|single-shop] [--shops 1]');options[flag.slice(2)]=flag==='--shops'?Number(value):value}
 if(!options.template||!options.output)throw new Error('Supply --template and --output; the source must be a genuine empty native export.')
 generateFile(options).then(report=>process.stdout.write(JSON.stringify(report,null,2)+'\n')).catch(error=>{process.stderr.write(error.message+'\n');process.exitCode=1})
}
