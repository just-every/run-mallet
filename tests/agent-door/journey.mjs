import auditCounts from './audit-counts.mjs'
export {beforeStep, afterStep} from './audit-counts.mjs'

export default async function nativeJourney(context) {
 await auditCounts(context)
}
