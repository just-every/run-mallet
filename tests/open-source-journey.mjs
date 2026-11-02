import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
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

// OPEN-001's published-command journey retains the built /run proof outside push Verify.
export async function publishedStartSite(root) {
 const site=join(root,'dist/site'),run=JSON.parse(readFileSync(join(root,'src/site/run.json'),'utf8'))
 const text=html=>html.replace(/<[^>]+>/g,' ').replaceAll('&nbsp;',' ').replaceAll(' ',' ').replace(/\s+/g,' ')
 execFileSync(join(root,'node_modules/.bin/rer'),['build','--site'],{cwd:root,stdio:'pipe'})
  const home = text(readFileSync(join(site, 'index.html'), 'utf8'))
  assert.ok(text(readFileSync(join(site,'run.html'),'utf8')).includes(run.clone),'OPEN-001: built /run publishes the command')
  assert.equal(JSON.parse(readFileSync(join(root,'rer-project.json'),'utf8')).license,'MIT')
  assert.match(readFileSync(join(root,'LICENSE'),'utf8'),/Permission is hereby granted, free of charge/)
  assert.ok(home.includes(run.clone), 'the one-line start is on the page')
  assert.doesNotMatch(home, /RER_[A-Z]+|127\.0\.0\.1|localhost|\[::1\]/, 'no rer output lines or local addresses')
  assert.doesNotMatch(home, /git clone|rer install|rer setup/, 'no multi-step install flow')
}
