import {e,money} from './ui/common'

export const FORM_CONSENT='I agree to the exact diagnostic fee, storage and teardown terms shown here, and to sign and receive this intake record electronically. This consent covers this intake only. This does not authorize additional repair work or a payment charge.'
export const ACKNOWLEDGMENTS=[
 {key:'liabilityWaiver',label:'Liability waiver'},
 {key:'deviceDataLoss',label:'Device data-loss and backup'},
 {key:'storageCharges',label:'Storage charges'},
] as const
export function intakeDisclosures(email:string){return {
 paperCopy:'You have the right to a paper copy. Ask the shop for a printed copy of this intake before or after signing. There is no fee for that copy.',
 withdrawal:'You may withdraw electronic consent by contacting the shop before signing and use a paper intake instead. After signing, contact the shop to withdraw consent for further electronic communications about this intake and request paper copies; withdrawal does not undo this signed record or its terms.',
 scope:'Electronic consent applies to this intake only. It does not cover other visits, repair authorizations or payments.',
 requirements:'You need an internet-connected phone, tablet or computer, a current web browser that displays HTML, and access to your email. To retain the copy, save the HTML document or print it (including print to PDF); a printer is needed for a paper copy. The attached JSON can also be opened in a text editor.',
 email:'The copy will be sent to '+email+'. To update that email, contact the shop before signing; the shop must revoke this link and issue a replacement link with the corrected copy email. Do not sign until the displayed address is correct.',
 access:'Open your signed copy to record demonstrated access to the electronic document. This records access through this private link; it does not verify your identity.',
}}
export function disclosureHtml(disclosures:Record<string,string>){return `<section aria-label="Electronic signing disclosures"><h3>Electronic signing disclosures</h3>${Object.values(disclosures).map(value=>`<p>${e(value)}</p>`).join('')}</section>`}
const acknowledgmentLabel=(key:string)=>ACKNOWLEDGMENTS.find(a=>a.key===key)?.label??key
export function signedIntakeHtml(r:any){return `<article id="signed-intake"><h2>Signed intake copy</h2><p>${e(r.label)}</p><p>${e(r.asset.label)} · ${e(r.asset.identifier)} · ${e(r.template.name)} · exact terms revision ${e(r.template.n)}</p><p>Form ${e(r.formId)} · repair ${e(r.jobId)}</p><h3>Diagnostic fee: ${money(r.template.diagnosticFeeCents)}</h3><p>Storage terms: ${e(r.template.storageTerms)}</p><p>Teardown terms: ${e(r.template.teardownTerms)}</p><dl><dt>Symptom</dt><dd>${e(r.answers.symptom)}</dd>${r.template.fields.map((f:any)=>`<dt>${e(f.label)}</dt><dd>${e(r.answers[f.key]||'Not supplied')}</dd>`).join('')}</dl>${(r.acknowledgments??[]).map((a:any)=>`<section><h3>${e(acknowledgmentLabel(a.key))}</h3><p>${e(a.text)}</p><p>Separately acknowledged: ${a.accepted?'Yes':'No'}</p></section>`).join('')}${r.electronicDisclosures?disclosureHtml(r.electronicDisclosures):''}<p>Signed by ${e(r.signature.typedName)}</p><p>Signed at ${e(r.signature.at)} (UTC)</p><p>${e(r.signature.consentText)}</p><p>Receipt SHA-256: <code>${e(r.sha256)}</code></p></article>`}
export function signedIntakeText(r:any){return [
 'Signed intake copy',r.label,`${r.asset.label} · ${r.asset.identifier}`,`${r.template.name} · exact terms revision ${r.template.n}`,`Form ${r.formId} · repair ${r.jobId}`,
 `Diagnostic fee: ${money(r.template.diagnosticFeeCents)}`,`Storage terms: ${r.template.storageTerms}`,`Teardown terms: ${r.template.teardownTerms}`,`Symptom: ${r.answers.symptom}`,
 ...r.template.fields.map((f:any)=>`${f.label}: ${r.answers[f.key]||'Not supplied'}`),
 ...(r.acknowledgments??[]).flatMap((a:any)=>[`${acknowledgmentLabel(a.key)}: ${a.text}`,`Separately acknowledged: ${a.accepted?'Yes':'No'}`]),
 ...(r.electronicDisclosures?['Electronic signing disclosures',...Object.values(r.electronicDisclosures)]:[]),
 `Signed by ${r.signature.typedName}`,`Signed at ${r.signature.at} (UTC)`,r.signature.consentText,`Receipt SHA-256: ${r.sha256}`,
 'The attached JSON contains this exact signed receipt. Ask the shop for a paper copy.',
 ].join('\n\n')}
export function signedIntakeDocument(r:any){return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Signed intake copy</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:48rem;margin:2rem auto;padding:0 1rem;color:#111}p,dd{white-space:pre-wrap;overflow-wrap:anywhere}dd{margin:0 0 1rem}code{overflow-wrap:anywhere}@media print{body{max-width:none;margin:0}h2,h3{break-after:avoid}}</style></head><body>${signedIntakeHtml(r)}</body></html>`}
export function signedIntakeMail(r:any){return {text:signedIntakeText(r),html:signedIntakeDocument(r),attachments:[{filename:'signed-intake.json',contentType:'application/json',content:new TextEncoder().encode(JSON.stringify(r,null,2)),disposition:'attachment' as const}]}}
