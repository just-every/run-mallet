import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

export async function verificationPlan() {
 const plan = JSON.parse(await readFile(new URL('../verification.json', import.meta.url), 'utf8'));
 const names = new Set();
 for (const tier of ['push', 'nightly']) {
  if (!Array.isArray(plan[tier])) throw Error(`Missing verification tier: ${tier}`);
  for (const shard of plan[tier]) {
   if (!/^[a-z][a-z0-9-]*$/.test(shard.name) || names.has(shard.name)) throw Error(`Invalid or duplicate shard: ${shard.name}`);
   if (typeof shard.browser !== 'boolean' || typeof shard.hosted !== 'boolean' || !Array.isArray(shard.commands) || !shard.commands.length || shard.commands.some(command => typeof command !== 'string' || !command.trim())) throw Error(`Incomplete shard: ${shard.name}`);
   names.add(shard.name);
  }
 }
 if (!plan.push.length || plan.push.filter(shard => shard.hosted).length !== 1) throw Error('Push verification must include the hosted production build');
 return { ...plan, push: balancedPush(plan.push) };
}

// The source plan keeps the assertions and standalone journey commands together.
// Push CI distributes the growing Mallet file across eight jobs instead of
// keeping all command journeys in one job and all browser journeys in another.
// Each prefix owns both kinds of journey, including browsers embedded in tests
// whose names do not mention a viewport. The final complement owns new prefixes.
function balancedPush(push) {
 const suites = new Map(push.map(shard => [shard.name, shard]));
 const used = new Set(['workshop-core', 'workshop-browser', 'security', 'retention', 'operations-core', 'operations-browser', 'operations-import']);
 const take = (...names) => names.flatMap(name => {
  const suite = suites.get(name);
  if (!suite) throw Error(`Missing verification suite: ${name}`);
  used.add(name);
  return suite.commands;
 });
 const prefixes = [
  'PAY-005|PART-006|RETURN-001|DIAG-002|RETURN-002|API-002|EST-004|BASE-AGENT-002|BASE-AGENT-005|BASE-AGENT-011|Stripe|native',
  'OPS-002|DVI-003|EST-001|GOV-006|INV-001|INVOICE-001|QUALITY-001|GOV-005|VEH-002',
  'AUTO-002|WARRANTY-001|ASSET-001|ADV-005|PORTAL-001|EST-002|BASE-AGENT-008|BASE-AGENT-012',
  'ADV-003|API-001|BUY-001|PART-005|AR-001|agent|GOV-002|RepairShopr',
  'PAY-001|EST-006|PART-002|PART-004|PART-003|REPORT-003|DVI-001|AUTO-004|import',
  'BOOK-001|AUTO-005|SUBLET-001|PART-007|PAY-004|GOV-004|TIME-001|FLOW-003|HTTP-001|dispatch',
  'ADV-008|FLOW-002|FLOW-004|CUS-001|PART-008|GOV-001|DIAG-001|DATA-001|OPS-001|booking',
 ];
 const patterns = prefixes.map(prefix => `^(?:${prefix})\\b`);
 patterns.push(`^(?!(?:${prefixes.join('|')})\\b)`);
 const tax = (pattern, skip = false) => take('sales-tax').map(command => command.replace(' tests/sales-tax.test.mjs', ` --test-${skip ? 'skip' : 'name'}-pattern='${pattern}' tests/sales-tax.test.mjs`));
 const mallet = index => `node --test --test-concurrency=1 --test-name-pattern='${patterns[index]}' tests/mallet.test.mjs`;
 const shard = (name, index, commands = [], hosted = false) => ({ name, browser: true, hosted, commands: [...commands, mallet(index)] });
 const result = [
  // Only this job builds and retains rer verify's hosted-output, hydration and
  // agent-door checks, plus emitted-worker parity, sponsor and Pause journeys.
  // Other harness browser journeys serve public/ directly.
  shard('core', 0, [...take('source', 'typecheck', 'runtime'), ...tax('^shop setup|^pre-US')], true),
  shard('work-graph-core', 1),
  shard('journeys-2', 2, [...take('media'), 'node --test --test-concurrency=1 tests/demo.test.mjs']),
  shard('journeys-3', 3, tax('^shop setup|^pre-US|1440|390', true)),
  shard('journeys-4', 4, take('pier')),
  shard('journeys-5', 5, tax('1440|390')),
  shard('journeys-6', 6, take('restore')),
  shard('journeys-7', 7, take('sales-report')),
 ];
 if (push.some(suite => !used.has(suite.name))) throw Error('Assign every verification suite to a push job');
 return result;
}

export function run(command, env = process.env) {
 console.log(`> ${command}`);
 const result = spawnSync('/bin/bash', ['-euo', 'pipefail', '-c', command], { stdio: 'inherit', env });
 if (result.error) throw result.error;
 if (result.status !== 0) process.exit(result.status ?? 1);
}

if (process.argv[1] === import.meta.filename) {
 const plan = await verificationPlan();
 const all = [...plan.push, ...plan.nightly];
 const selected = process.env.SEED_VERIFY_SHARD;
 const shards = selected ? all.filter(shard => shard.name === selected) : all;
 if (!shards.length) throw Error(`Unknown verification shard: ${selected}`);
 for (const shard of shards) for (const command of shard.commands) run(command);
}
