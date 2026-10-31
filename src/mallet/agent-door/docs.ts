import { pageStyle } from '../../modules/agent-door/page-style.ts'
import { e } from '../ui/common'
import { nativeTools } from './tools.ts'
import { preparationBoundaries, preparationPrompts } from './prompts.ts'

export const agentLimits = { requestsPerMinute: 600, maxBodyBytes: 1048576 }

/** Public documentation contains registry metadata only, never repair or credential data. */
export function agentDocs(): Response {
  const nonce = crypto.randomUUID().replaceAll('-', '')
  const tools = [...nativeTools].sort((a, b) => a.name.localeCompare(b.name))
  const body = `<h1>Service advisor preparation</h1><p>Mallet's adopted MCP door is <code>/mcp</code>. Discover the tools and schemas, then retrieve a preparation prompt. Every call still needs current authority and the company's policy.</p>
    <section><h2>Preparation prompts</h2><p>List with <code>prompts / list</code>; retrieve by name with <code>prompts / get</code>. Listing and retrieval do not execute the plan.</p><ul>${[...preparationPrompts].sort((a, b) => a.name.localeCompare(b.name)).map(prompt => `<li data-prompt-name="${e(prompt.name)}"><strong>${e(prompt.title)}</strong><p><code>${e(prompt.name)}</code></p><p>${e(prompt.description)}</p></li>`).join('')}</ul></section>
    <section><h2>Boundaries</h2><ul>${preparationBoundaries.map(text => `<li>${e(text)}</li>`).join('')}</ul></section>
    ${tools.map(tool => `<section data-tool-name="${e(tool.name)}"><h2>${e(tool.title)}</h2><p><code>${e(tool.name)}</code></p><p>${e(tool.description)}</p><dl class="fields"><div><dt>Scope</dt><dd>${e(tool.scope)}</dd></div><div><dt>Computed classes</dt><dd>${e(tool.classes.join(', '))}</dd></div><div><dt>Effect</dt><dd>${tool.readOnly ? 'Reads permitted native records.' : 'Saves a draft for a person to decide.'}</dd></div><div><dt>Classification proof</dt><dd><code>agent-surface.json</code> journey fixtures, run under autonomous and held policies by the conformance harness.</dd></div></dl></section>`).join('')}
    <section><h2>Limits and unfinished surface</h2><p>Requests are limited to ${agentLimits.requestsPerMinute} per minute and bodies to ${agentLimits.maxBodyBytes.toLocaleString('en-US')} bytes. The server discovery metadata gives the limits in force.</p><p>Public resource templates, events and subscriptions are undeclared. Internal resource adapters do not offer a public catalogue. Wider specialist jobs, full repair-week conformance and owner-native administration remain incomplete.</p><p>Calls can refuse insufficient scope, stale revisions, missing evidence or policy permission. An active native webhook refuses preparation with <code>queued_effect_not_adopted</code>. A prompt cannot bypass any refusal.</p></section>`
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Service advisor preparation · Mallet</title><style nonce="${nonce}">${pageStyle}code{overflow-wrap:anywhere}li{margin-block:12px}</style></head><body><header><a href="/">Mallet</a><a href="/agents">Agent activity</a></header><main>${body}</main></body></html>`, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
      'content-security-policy': `default-src 'none'; style-src 'nonce-${nonce}'; frame-ancestors 'none'; base-uri 'none'` },
  })
}
