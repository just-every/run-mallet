// The run site (run-mallet.com) as `rer build --site` writes it: a visitor reaches /run from the homepage's primary
// action, every link and file a page names resolves inside the site, no page links an instance-only route, and the
// homepage shows how to start Mallet only as the one-line start, with no local addresses or rer output.
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = new URL('../..', import.meta.url).pathname
const site = join(root, 'dist/site')
const run = JSON.parse(readFileSync(join(root, 'src/site/run.json'), 'utf8'))
const pages = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? pages(join(dir, entry.name)) : entry.name.endsWith('.html') ? [join(dir, entry.name)] : [])
const served = path => [path, `${path}.html`, join(path, 'index.html')].some(candidate => existsSync(join(site, candidate)) && !candidate.endsWith('/'))
const attrs = (html, name) => [...html.matchAll(new RegExp(`\\s${name}="([^"]*)"`, 'gi'))].map(match => match[1].replaceAll('&amp;', '&'))
const text = html => html.replace(/<[^>]+>/g, ' ').replaceAll('&nbsp;', ' ').replaceAll(' ', ' ').replace(/\s+/g, ' ')

test('the run site builds, Run Mallet opens /run, and every link and file a page names resolves', () => {
  execFileSync(join(root, 'node_modules/.bin/rer'), ['build', '--site'], { cwd: root, stdio: 'pipe' })
  const home = readFileSync(join(site, 'index.html'), 'utf8')
  assert.match(home, /<a class="run-pill" href="\/run">/, 'the homepage leads with Run Mallet to /run')
  assert.ok(served('run') && served('docs'), '/run and /docs are built')
  for (const file of pages(site)) {
    const html = readFileSync(file, 'utf8'), where = relative(site, file)
    const sets = [...attrs(html, 'srcset')].flatMap(set => set.split(',').map(part => part.trim().split(/\s+/)[0]))
    for (const ref of [...attrs(html, 'href'), ...attrs(html, 'src'), ...sets].filter(ref => ref.startsWith('/') && !ref.startsWith('//'))) {
      const path = decodeURIComponent(ref.split(/[?#]/)[0])
      assert.doesNotMatch(path, /^\/(signin|login|sign-in|setup|app|auth)(\/|$)/, `${where} links the instance-only ${path}`)
      if (path !== '/') assert.ok(served(path), `${where} names ${path}, which the site does not serve`)
    }
  }
})

test('OPEN-001: MIT run site publishes the one-line start without installation data', () => {
  const home = text(readFileSync(join(site, 'index.html'), 'utf8'))
  assert.ok(text(readFileSync(join(site,'run.html'),'utf8')).includes(run.clone),'OPEN-001: built /run publishes the command')
  assert.equal(JSON.parse(readFileSync(join(root,'rer-project.json'),'utf8')).license,'MIT')
  assert.match(readFileSync(join(root,'LICENSE'),'utf8'),/Permission is hereby granted, free of charge/)
  assert.ok(home.includes(run.clone), 'the one-line start is on the page')
  assert.doesNotMatch(home, /RER_[A-Z]+|127\.0\.0\.1|localhost|\[::1\]/, 'no rer output lines or local addresses')
  assert.doesNotMatch(home, /git clone|rer install|rer setup/, 'no multi-step install flow')
})
