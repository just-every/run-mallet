import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { userInfo } from 'node:os'
import { chromium } from '@playwright/test'

/** Render the real production responses with only the disposable native cookies. */
export async function memberScreens({ c, b, fixture, approval }) {
 const directory = process.env.MALLET_AGENT_SCREENS ?? '.cache/agent-member'
 await mkdir(directory, { recursive: true })
 const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  env: { ...process.env, HOME: userInfo().homedir },
  args: ['--use-mock-keychain', '--password-store=basic', '--disable-gpu'] })
 try {
  for (const [label, principal, pages] of [
   ['owner', c, [[`/app/jobs/${fixture.member.job.id}`, fixture.member.job.title], [`/app/jobs/${fixture.owner.job.id}`, fixture.owner.job.title], ['/agents', 'Agents'], [new URL(approval.url).pathname, 'approval']]],
   ['member', b, [[`/app/jobs/${fixture.member.job.id}`, fixture.member.job.title], [`/app/jobs/${fixture.owner.job.id}`, null], [new URL(approval.url).pathname, null]]],
  ]) {
   const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, extraHTTPHeaders: { Cookie: principal.person.cookie } })
   await context.route(c.origin + '/**', async route => {
    const req = route.request()
    const response = await c.request(req.url(), { method: req.method(), headers: req.headers(), ...(req.postDataBuffer() ? { body: req.postDataBuffer() } : {}) })
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) })
   })
   const page = await context.newPage()
   for (const [index, [path, expected]] of pages.entries()) {
    const response = await page.goto(c.origin + path)
    if (expected) {
     assert.equal(response.status(), 200)
     const content = await page.locator('body').innerText()
     if (path.startsWith('/app/jobs/')) assert.ok(content.includes(expected), 'native repair title is visible')
     if (path === '/agents') {
      assert.ok(content.includes('Cedar Workshop Owner') && content.includes('member'), 'both native sponsor names render')
     }
    } else {
     assert.ok([403, 404].includes(response.status()), 'private page refuses the member session')
     const content = await page.locator('body').innerText()
     assert.ok(!content.includes(fixture.owner.job.title) && !content.includes(fixture.owner.asset.identifier), 'refused page exposes no private repair')
    }
    for (const width of [1440, 390]) {
     await page.setViewportSize({ width, height: 1000 })
     assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'native page fits viewport')
     await page.screenshot({ path: `${directory}/${label}-${index}-${width}.png`, fullPage: true })
    }
   }
   await context.close()
  }
  console.log('PROBE BASE-AGENT-004 screens: built repair, agents and pending-preparation pages at 1440 and 390 -> owner visibility, exact sponsor names and member refusals')
 } finally { await browser.close() }
}
