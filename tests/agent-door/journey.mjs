import auditCounts, {beforeStep as auditBefore, afterStep as auditAfter} from './audit-counts.mjs'
import sponsorAdmissionJourney, {beforeStep as nativeBefore, afterStep as nativeAfter} from './sponsor-admission.mjs'

export const beforeStep = async context => { await auditBefore(context); await nativeBefore(context) }
export const afterStep = async context => { await auditAfter(context); await nativeAfter(context) }

/** Weekly audit counts run first: the prompt journey revokes the key the six-tool reads need. */
export default async function nativeJourney(context) {
 await auditCounts(context)
 await sponsorAdmissionJourney(context)
}
