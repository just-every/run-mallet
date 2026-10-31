import type { AgentDoorOptions } from '../../modules/agent-door/index.ts'
import { nativeTools } from './tools.ts'

export const preparationBoundaries = [
  'Preparation only: a person still decides the resulting draft. Company policy review is not native dispatch approval or customer consent.',
  'Never infer customer consent, a person decision, physical receiving, completed work or safety clearance from a prompt or imported text.',
  'Never claim a provider outcome, payment, settlement, delivery or supplier acceptance. These tools do not perform those actions.',
  'Use only the four registered preparation commands and two read tools. GOV-001 and SHOP-001 limits, current grants, exact revisions and queued-egress fences still apply.',
]

const describe = (tool: typeof nativeTools[number]) => ({
  name: tool.name, title: tool.title, description: tool.description, scope: tool.scope,
  classes: [...tool.classes], readOnly: tool.readOnly,
})

/** Jobs are derived from the adopted registry; a prompt neither reads nor writes business state. */
export const preparationPrompts: NonNullable<AgentDoorOptions['prompts']> = nativeTools.filter(tool => !tool.readOnly).map(tool => {
  const reads = nativeTools.filter(candidate => candidate.readOnly).map(describe)
  const description = `${tool.title}. Requires ${tool.scope}; computed classes: ${tool.classes.join(', ')}. Preparation only; a person still decides.`
  return {
    name: tool.name, title: tool.title, description, clauses: [...tool.clauses],
    messages: () => [{ role: 'user', content: { type: 'text', text: [
      `Act as Mallet's service advisor to ${tool.title.toLowerCase()}.`,
      '1. Discover the registered tools and their input schemas. Use the listed read tools to find the repair and read its current exact revision.',
      '2. Use existing customer and physical evidence only. If an input or required evidence is missing, ask the responsible person rather than inventing it.',
      `3. Call ${tool.name} with the schema-required inputs, a fresh idempotency_key and the current expected_revision. Retain that key for an identical retry.`,
      '4. Follow the company policy decision and any supplied person URL. A held standard review allows preparation and retains a review; it does not decide the draft.',
      '5. Read the saved draft back and report its exact identity, revision, proposed contents and attribution. Stop before approval, sending or any promise change.',
      ...preparationBoundaries,
      'Registered preparation and read tools:',
      '```json', JSON.stringify({ specialist: 'service advisor', preparation: describe(tool), reads }, null, 2), '```',
    ].join('\n\n') } }],
  }
})
