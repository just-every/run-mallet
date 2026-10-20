# Repair routing and escalation (FLOW-003)

Routing is available through the existing authenticated owner/admin command API,
`POST /api/mallet/commands`, and its retained results in `GET /api/mallet/state`.
Use a native session and same-origin JSON requests. No new login, bearer grant or
customer door is introduced. Routing assigns the staff handler of a case; it
never moves the repair's technician, bay, booking or customer-approved scope.
Technician changes still require the existing dispatch proposal and approval.

## Configure and submit

Send `routing.configure` with `policyVersion: 0` for the first policy (thereafter
the current policy version), a reason, an active owner/admin `managerId`, ordered
`rules`, `calendar`, and `deadlineMinutes`. The API resolves all operator IDs and
names from native identity and fences the snapshot in the write transaction.
Client-supplied people, roles or names never confer authority.

Each rule contains a unique `id`, exact `location`, `repairType`, `skill`,
`priority` (`normal`, `high`, `urgent` or `any`) and active owner/admin `handlerId`.
Locations and skill labels are shop-declared routing metadata, not new locations,
access grants or certification of a person's qualifications. The first matching
rule in saved order wins; all three labels and the repair board priority must
match (except `any`). An existing active handler keeps the case until removed
from active native staff. A removed handler is replaced by the first active
matching rule, preserving the prior assignment. No match leaves an unassigned
blocker. Until dedicated manager/advisor roles exist, the current native
owner/admin staff perform these duties under their existing authority; future
GOV-001 roles inherit the routing boundary.

A calendar has an explicit IANA `timeZone`, `weekdays` (Sunday 0 through Saturday
6), `openMinute` and `closeMinute` (minutes since local midnight, same-day opening
inclusive and closing exclusive), and optional YYYY-MM-DD `closedDates`.
At least one weekday must open; overnight hours must be represented by a future
calendar extension rather than guessed. Each of the four blocker kinds has a
1–10,080 open-minute deadline. Policy edits retain every revision and reason.
Existing blocker episodes retain their original calendar, deadline and manager.

Example configuration input (replace operator IDs with your native staff IDs):

```json
{
  "policyVersion": 0,
  "managerId": "OWNER_ID",
  "reason": "Route specialist intake to the service desk",
  "rules": [{"id":"brakes","location":"Detroit","repairType":"brakes","skill":"hydraulics","priority":"urgent","handlerId":"ADVISOR_ID"}],
  "calendar": {"timeZone":"America/New_York","weekdays":[1,2,3,4,5],"openMinute":540,"closeMinute":1020,"closedDates":[]},
  "deadlineMinutes": {"unassigned":60,"approval-waiting":120,"parts-stalled":240,"diagnostic-exception":60}
}
```

Submit `routing.intake` with the current `jobId`/`version` and its `location`,
`repairType` and required `skill`. Intake is retained once for that repair.
Set urgency through the existing `flow.priority` command. Run `routing.run` to
route current cases immediately; the installed 15-minute Worker cron also runs
routing. The command takes no trusted people or clock inputs from its caller.

## Blockers and their history

The scheduler observes unassigned cases, estimates awaiting a staff/customer
decision, required parts without physical receipt, and explicitly recorded
diagnostic exceptions. Add a diagnostic exception with `routing.exception`,
`jobId`, current job `version`, current `caseVersion` and the measured `detail`.
It does not alter a diagnosis or invent a diagnostic finding.

Each source blocker has one open episode with its source key, description,
opening time, deadline, calendar snapshot and manager. Replays do not reset the
deadline or duplicate an episode. The deadline starts at the next whole UTC
minute; each real minute whose shop-local start lies in open hours counts.
Its ending boundary is the deadline. Closed dates and overnight minutes count
zero; repeated local DST minutes count twice and nonexistent minutes count zero.
An escalation becomes due at that inclusive instant and is recorded by the next
cron execution (normally within 15 minutes), or an immediate `routing.run`.

An unacknowledged episode creates one durable internal escalation task addressed
to its named active manager. If that manager was deactivated, the current active
owner acts in their place; historical actor attribution never grants authority.
This is an internal record, not an email/SMS send or delivery claim. Inspect
`records.routingCase` for assignments and `records.routingBlocker` for tasks,
acknowledgments and resolutions. These records and their audit events remain
under the existing owner/admin boundary; members and preparation agents receive
neither routing records nor routing audit events.

Use `routing.acknowledge` with `blockerId`, its current `version` and `note` to
retain acknowledgment. Acknowledging before the deadline suppresses escalation;
a later acknowledgment preserves the escalation already recorded. A diagnostic
exception can be resolved with `routing.resolve`, `blockerId`, current `version`
and `reason` containing the resolution evidence. Other blockers resolve only
when the actual source clears: a handler is assigned, the exact estimate is
decided, physical parts arrive, or the repair ends. Staff cannot mark an unpaid
approval or unreceived part clear through routing. A genuinely recurring source
opens a new episode; old acknowledgment/escalation/resolution history remains.

All policy, case, assignment, exception, blocker and audit history is included
in the ordinary OPS-001 workshop archive. Restore preserves exact history and
requires fresh native owner authority. It never revives an old account or
replays a previously issued escalation.
