import type {Bindings} from '../auth.server'
import {runCoverageReviews} from './coverage-door'
import {runWebhooks} from './webhook-door'
import {runReportSchedules} from './reports/schedules'
import {runApprovalChase} from './approval-door'
import {runRouting} from './routing-door'
import {runRepairBlockers} from './repair-blocker-door'
import {expireIntakeSecrets} from './intake-secrets'

/** Production and native Worker journeys execute the same scheduled work. */
export async function runMalletScheduled(env:Bindings,at:number){
 await runCoverageReviews(env,at)
 await runWebhooks(env,at)
 await runReportSchedules(env,at)
 await runApprovalChase(env,at)
 await runRouting(env,at)
 await runRepairBlockers(env,at)
 await expireIntakeSecrets(env,new Date(at).toISOString())
}
