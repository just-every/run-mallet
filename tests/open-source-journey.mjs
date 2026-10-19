import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {join} from 'node:path'

// Check the delivered source, rather than a fixture or an npm package's license.
export async function openSourceInstallation(checkout) {
 const license=await readFile(join(checkout,'LICENSE'),'utf8'),project=JSON.parse(await readFile(join(checkout,'rer-project.json'),'utf8'))
 assert.equal(project.license,'MIT','OPEN-001: installation declares the MIT grant')
 assert.match(license,/Permission is hereby granted, free of charge/,'OPEN-001: use is free')
 assert.match(license,/use, copy, modify, merge, publish, distribute, sublicense/,'OPEN-001: source permits modification and redistribution')
 const paywall=/(?:activate|buy|enter|purchase)\s+(?:a\s+|your\s+)?Mallet\s+licen[cs]e|upgrade\s+(?:your\s+)?Mallet\s+(?:plan|subscription)|Mallet\s+(?:per[- ]seat|per[- ]shop|license key)/i
 const visit=async dir=>{for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())await visit(path);else if(/\.(?:ts|tsx|js|mjs|json)$/.test(entry.name))assert.doesNotMatch(await readFile(path,'utf8'),paywall,`OPEN-001: installed application has no Mallet commercial gate (${path.slice(checkout.length+1)})`)}}
 await visit(join(checkout,'src'))
 return paywall
}
