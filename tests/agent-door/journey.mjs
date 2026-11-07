import auditCounts, {beforeStep as auditBefore, afterStep as auditAfter} from './audit-counts.mjs'
import preparationJourney, {beforeStep as preparationBefore, afterStep as preparationAfter} from './preparation-journey.mjs'

export async function beforeStep(context) {
 await preparationBefore(context)
 await auditBefore(context)
}
export async function afterStep(context) {
 await auditAfter(context)
 await preparationAfter(context)
}
export default async function nativeJourney(context) {
 await preparationJourney(context)
 await auditCounts(context)
}
