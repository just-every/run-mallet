import prompts, { beforeStep as promptBefore, afterStep as promptAfter } from './prompts.mjs'
import refusedClassification, { afterStep as classificationAfter } from './refused-classification.mjs'
import { sponsorAdmission } from './sponsor-admission.mjs'
import resources, { afterStep as resourceAfter } from './resources.mjs'
import attribution, { afterStep as attributionAfter } from './native-attribution.mjs'

export const beforeStep = promptBefore
export async function afterStep(context) {
  // Compare undecided drafts first; resource and attribution journeys then
  // exercise separate native owner decisions against those exact drafts.
  await classificationAfter(context)
  await promptAfter(context)
  await resourceAfter(context)
  await attributionAfter(context)
}
export default async function preparationJourney(context) {
  await refusedClassification(context)
  await resources(context)
  await prompts(context)
  await attribution(context)
  await sponsorAdmission()
}
