# Mallet CI critical path report

Tag: sx-mallet-ci-critical-path-1
Repository: just-every/run-mallet
Product branch: cloud/sx-mallet-ci-critical-path-1
Product head: 05f12bb25287d22654fda8b2a549712d14e94c1c
Base: 1331aef49644cea21ff44371ae4d7218bb588646
PR: none; repository instructions do not require one for this lane handoff.

## Scope and custody

The initial cloud setup applied fleet identity and bundle-backed authentication and preserved repository hooks. The custody query found no open cloud/sx-mallet-ci* or cloud/sx-mallet-cishape* branch, confirmed by Git ref enumeration before the first edit. The first GraphQL query was rejected because a refPrefix must end in a slash; the corrected query completed and is retained as custody.json. No other repository was cloned or written.

Only .github/workflows/verify.yml, scripts/verify-app.mjs and the regenerated sources.lock.json changed. All 258 tracked test, migration, contract, generated-view and verification-source files inspected by SOURCE-INTEGRITY.json remain byte-identical to main. No product, test, migration, contract, assertion or threshold was changed. No new permanent test was added.

## Plan and implementation

The full plan is in PLAN.md. Current main supplied 15 push shard jobs. The historical cancelled run used the same names. It spent 996 seconds (16m36s) in workshop-core under its special 19-minute allowance and cancelled workshop-browser at 737 seconds (12m17s) at its 12-minute limit. The sales-tax job took 664 seconds. Complete actual historical job durations are in baseline-jobs.json and BASELINE-TIMING.json. The historical log archive CLI call returned no text, so no per-test historical timing is claimed.

The invoked verification script now composes the source verification suites into eight push jobs. Disjoint anchored prefix groups distribute all 164 Mallet tests, including complete core/browser journeys and embedded browser work. The last group skips the positive union of assigned prefixes, leaving every other prefix. A negative name selector was removed after an isolated run and a two-test reproduction showed Node also matched its file container, executing already assigned children. Three disjoint selections distribute the five sales-tax tests. Other suites remain complete, with their original command arguments. Exactly one hosted wrapper retains the production output, hydration and agent-door assertions. Build counts here refer to explicit CI build commands. The unchanged Pause test fixture retains its internal Vite setup, preserving the existing journey. The redundant browser-shard build is removed, leaving one explicit build. The parity, sponsor-admission and Pause browser journeys use the emitted Worker and are assigned to core after its build; other harness browsers use public assets independently.

The default timeout is 12 minutes for all eight jobs; the workshop-core 19-minute exception was removed. No timeout increased. The plan job, push/PR/dispatch/call entrypoints, concurrency group, cancel-in-progress behavior, fail-fast setting, ubuntu-24.04 runner, dependency/install/cache steps and nightly clone journey remain unchanged.

## Coverage proof

MAPPING.md gives every test/journey's actual before and after selection; mapping.json includes the same data and all non-test commands. The mapping parses actual test registrations with TypeScript and evaluates command selectors. It is cross-checked by node-selection-proof.mjs using actual Node 22.20.0 CLI selection over no-op copies of every registration. NODE-SELECTION-RECEIPT.json proves 187 before / 187 after, each selected exactly once. The initial regex-only proof did not model Node file-container matching and was insufficient; the final proof covers that behavior. mapping-proof.mjs is the actual standalone reproduction script; run it from the product checkout root with the packet directory as its argument.

Counts: 187 registered tests before and after, each exactly once. Push shards: 15 to 8. Explicit builds: 2 to 1. Hosted verification wrappers: 1 to 1. Nightly standalone clone journey: 1 to 1. Source check, contract check, typecheck, emitted runtime journey, hosted-output, hydration and agent-door checks remain. No duplicate assertion was added to fill a shard and no test was weakened or dropped.

## Validation and limitations

CI syntax, push/all matrix generation, complete mapping proof, first-party source policy, typecheck, production build, generated contract document check, regenerated source-lock check and whitespace check passed locally. The documented lock regeneration ran after source edits and checks, then its freshness check passed. Local journey measurements and original failures are recorded in LOCAL-RECEIPT.json; it is a diagnostic record, not a claim that every invocation passed.

The initial sales-tax browser test lacked the expected Playwright executable; after configuring its browser path to the VM's /usr/bin/chromium, the unchanged case passed. OPS-002's concurrent cron assertion returned exception instead of ok in its first two diagnostic runs. A later diagnostic loader, kept outside the checkout and preserving the original assertion, passed. The loader could emit only recognized infrastructure error codes and emitted none on that passing run. These observations do not establish the cause of the intermittent failure. Exact hosted Verify remains authoritative for the candidate. The new core job additionally passed end to end locally with 19/19 assigned tests, one build, emitted runtime, hosted output, hydration and 671/671 agent-door conformance points (NEW-CORE-RECEIPT.json). All 187 distinct tests have a passing local measurement across the diagnostic batches; the initial failed invocations remain recorded rather than being erased.

All four product pushes succeeded on their first transport attempts through cloud-push.py. Follow-up commits keep Pause, parity and sponsor-admission journeys in core after the production build, correcting dependencies missed in the initial grouping without rewriting published history. Every candidate commit identity and message was inspected before every push: fleet author and committer, no trailers. No main/default branch push, rebase, history rewrite or workflow dispatch occurred. Main was fetched after the product push and remained at the recorded base.

## Clause and acceptance status

No clause status changed. Core remains 23 done / 75 partial / 54 missing, total 152. Agent surface remains 0 done / 13 partial / 5 missing, total 18. Full target remains 23 done / 88 partial / 59 missing, total 170. The generated views were not committed. This CI change establishes no new product acceptance or publication-scan result.

## Hosted result

Initial push Verify: run 42307875520 at 8aabf89351f18f4e3be8ab17d064e101dd6e11f3. Job 128201758109 (journeys-3) and job 128201758141 (journeys-4) failed. work-graph-core (128201758134) and journeys-7 (128201758240) were cancelled after the second product push; this is not evidence of an independent timeout. The final candidate is 05f12bb25287d22654fda8b2a549712d14e94c1c. Both failed-job archive commands succeeded once. They show hosted_output_missing for BASE-AGENT-005 (sponsor admission) and BASE-AGENT-002 (preparation parity), not an allowed infrastructure class. Both have been moved into the build-owning core job. A later isolated fallback run also exposed duplicate execution caused by Node file-container matching of the negative selector; 05f12bb replaces that selector with a positive skip union, and actual Node CLI selection now proves exactly-once coverage. No failed-job rerun was used for those real setup failures. Final status and duration receipts are below. The final exact-SHA Verify is green and satisfies the shard-count, duration and balance targets. READY applies to the product branch, not product acceptance or landing.

## Final isolated validation context

The six non-core modes unaffected by the selector correction and core use commands byte-identical to the final plan (COMMAND-EQUIVALENCE.json); receipts preserve their actual producing head f0316b3. The corrected fallback is rerun in a clean isolated worktree at 05f12bb, initially without dist. Eight diagnostics share this VM’s five CPUs; those elapsed times do not establish GitHub runner bounds. The invalid fallback diagnostic was intentionally stopped after exposing duplicate selection; its exit 241 is retained as such, not reported as a final-candidate regression. The recurring OPS-002 cron assertion has also appeared in the isolated work-graph mode.

## Final hosted result and handoff

READY product head: 05f12bb25287d22654fda8b2a549712d14e94c1c.

Verify run 42310937549: https://github.com/just-every/run-mallet/actions/runs/42310937549

Every expected job, including the existing aggregate verify gate, is completed/success on this exact SHA. The final commit check-runs REST read collected statuses and durations together without exceeding the ten-call budget. No success from a previous SHA or another workflow is substituted. FINAL-CI-RECEIPT.json contains every job ID, exact head, timestamp, conclusion and URL; final-check-runs.json retains the actual REST response. The final run required no builder-requested rerun or dispatch.

Push jobs: 8. Longest: work-graph-core, job 128212098713, 407 seconds (6m47s). Mean: 327.625 seconds (5m27.625s). Longest/mean: 1.2423, below 1.5. Margin to the unchanged 12-minute limit: 313 seconds (5m13s). Core takes 380 seconds (6m20s). Compared with the historical completed workshop-core job, the longest falls from 996 to 407 seconds, a reduction of 589 seconds (59.1%). The historical cancelled browser job is censored and is not treated as a successful measurement.

| Shard | Job ID | Seconds | Result |
| --- | --- | ---: | --- |
| shards (journeys-6, true) | 128212098926 | 246 | success |
| shards (core, true) | 128212098909 | 380 | success |
| shards (journeys-7, true) | 128212098777 | 279 | success |
| shards (journeys-5, true) | 128212098774 | 255 | success |
| shards (journeys-3, true) | 128212098771 | 374 | success |
| shards (journeys-2, true) | 128212098733 | 360 | success |
| shards (journeys-4, true) | 128212098728 | 320 | success |
| shards (work-graph-core, true) | 128212098713 | 407 | success |

Local checks: final source policy, contract generation check, source-lock freshness, CI syntax, push/all matrices and actual Node selector proof passed. All 187 distinct tests have passing measurements across diagnostic batches. The final-equivalent isolated shard validation records 186 passes and one recurring OPS-002 cron assertion failure; the corrected fallback passes all 29 tests, core passes all 22 assigned tests and all 671 agent-door points. This intermittent local failure is retained honestly in ISOLATED-FINAL-RECEIPT.json. Hosted work-graph-core passes on the final SHA. Test code and thresholds were not changed to make it pass.

There are no remaining builder blockers under the CI-command build count. No clause statuses changed and no product acceptance was promoted. Only the named cloud branch was pushed; the fleet still owns publication scanning and landing. No PR was required or created. All report publication goes through the separate evidence ref and conveys no landing authority.
