import {REVIEW_WORDING,REVIEW_WORDING_VERSION,reviewContent} from '../reviews'
import {optedOut} from '../approval-chasing'
import {area,box,e,field,form,hidden,rows,select,when} from './common'

const channels:Record<string,string>={'customer-form':'Customer form','customer-email':'Customer email',telephone:'Telephone','in-person':'In person'}

function permissionHistory(consent:any) {
 const provenance=`<p>Recipient: ${e(consent.to)}</p><p>Permission given ${when(consent.consentedAt)} · ${e(channels[consent.captureChannel])}</p><p>Source evidence: ${e(consent.sourceEvidence)}</p><p>Recorded by ${e(consent.by.name)} · ${when(consent.at)}</p><p>Exact permission wording: ${e(consent.wording)}</p>`
 const withdrawal=consent.withdrawnAt?`<p>Permission withdrawn ${when(consent.withdrawnAt)}${consent.withdrawal?` · ${e(consent.withdrawal.by.name)} · ${e(consent.withdrawal.reason)}`:''}</p>`:form('review.withdraw',area('Withdrawal reason','reason','','required maxlength="2000"'),'Withdraw review permission',{jobId:consent.jobId,consentId:consent.id,version:consent.version})
 return `<li class="plain"><h3>Recorded review permission</h3>${provenance}${withdrawal}</li>`
}

function requestHistory(request:any) {
 const status=request.status==='development'?'Saved':request.status==='accepted'?'Accepted by mail provider':request.status==='failed'?'Email failed; staff review required':request.status==='uncertain'?'Email outcome uncertain; staff review required':'Email handoff unconfirmed; staff review required'
 const handoff=request.status==='development'?'':`<p>Provider handoff: ${e(request.provider??'not confirmed')}${request.outcomeAt?` · ${when(request.outcomeAt)}`:''}. ${request.status==='accepted'?'Delivery and customer receipt are not confirmed.':'No automatic retry or resend.'}</p>`
 const response=request.response?`<h3>Private customer feedback</h3>${request.response.erasedAt?'<p>Private feedback erased.</p>':`<p>Rating: ${e(request.response.rating)} of 5 · ${when(request.response.at)}</p><p>Submitted through the private link. Customer identity was not verified.</p>${request.response.feedback?`<p>${e(request.response.feedback)}</p>`:''}`}${request.taskId?`<p><a href="/app/jobs/${e(request.jobId)}#crew">Open feedback follow-up task</a></p>`:''}`:''
 const resolution=request.resolution?`<p>Staff resolution: ${e(request.resolution.reason)} · ${e(request.resolution.by.name)} · ${when(request.resolution.at)}</p>`:['failed','uncertain','claimed'].includes(request.status)?form('review.resolve','<p>Record the staff decision here. This does not resend the request.</p>'+area('Staff resolution reason','reason','','required maxlength="2000"'),'Record staff resolution',{jobId:request.jobId,id:request.id,version:request.version}):''
 return `<li class="plain"><h3>${e(status)}</h3><p>Recipient: ${e(request.to)}</p><p>Approved by ${e(request.by.name)} · ${when(request.at)}</p><h3>Approved message</h3><p>${e(request.content)}</p><p><a href="${e(request.reviewUrl)}">Google review invitation</a></p>${handoff}${request.providerReference?`<p>Provider reference: ${e(request.providerReference)}</p>`:''}${response}${resolution}</li>`
}

function permissionForm(job:any,email:string) {
 return form('review.consent',field('Recipient email','to','email',email,'required maxlength="254"')+`<p>${e(REVIEW_WORDING)}</p>`+'<label><input type="checkbox" name="consent" value="yes" required> The customer explicitly agreed to this exact review email permission.</label>'+field('Permission time with UTC offset','consentedAt','text','','required placeholder="2026-11-01T09:00:00-05:00"')+select('Permission capture channel','captureChannel',Object.entries(channels))+area('Permission source evidence','sourceEvidence','','required maxlength="2000"'),'Record review permission',{jobId:job.id,wordingVersion:REVIEW_WORDING_VERSION})
}

function sendForm(job:any,consent:any) {
 return form('review.send',`<p>Send one review invitation to ${e(consent.to)} for this paid handover. Every customer sees the same Google review invitation, regardless of any private rating.</p>`+field('Google Business Profile review URL','reviewUrl','url','','required pattern="https://.*" maxlength="2000"')+`<details><summary>Email wording</summary><p>${e(reviewContent('[your entered Google review link]'))}</p><p>A private, seven-day satisfaction link is included. No customer details are published.</p></details>`+'<label><input type="checkbox" name="confirm" value="yes" required> I approve this recipient and one review request under the recorded permission.</label>','Send review request',{jobId:job.id,consentId:consent.id,version:consent.version})
}

export function reviewPanel(s:any,job:any,actor:any) {
 if(actor.role!=='owner')return ''
 const handover=rows(s,'handover').find(r=>r.jobId===job.id),consents=rows(s,'reviewConsent').filter(r=>r.jobId===job.id),requests=rows(s,'reviewRequest').filter(r=>r.jobId===job.id)
 const total=handover?.invoice?.totals?.totalCents,settlement=handover?.settlement
 const paid=!!handover&&total>0&&!settlement.override&&!settlement.accountTerms&&settlement.verifiedCents+(settlement.tender?.recordedCents??0)>=total
 const asset=rows(s,'asset').find(r=>r.id===job.assetId),email=asset?.customerEmail?.trim().toLowerCase()??''
 const request=requests.find(r=>r.handoverId===handover?.id),consent=consents.filter(r=>r.handoverId===handover?.id&&!r.withdrawnAt&&r.to===email).at(-1)
 const withdrawn=rows(s,'reviewConsent').some(r=>r.to===email&&r.withdrawnAt)||optedOut(s,email)
 const next=!paid?'<p>Awaiting a paid, documented handover before recording review permission or sending a request. Unpaid release exceptions, commercial account terms and zero-total invoices do not qualify.</p>':request?'<p>A review request has already been recorded for this paid handover. It cannot be resent.</p>':asset?.privacyErasedAt?'<p>The customer profile has been erased. Review requests are unavailable.</p>':withdrawn?'<p>The customer withdrew email permission. A review request cannot be sent.</p>':consent?.localAuthority?sendForm(job,consent):(consent?'<p>This permission is historical. Record fresh customer permission under this installation’s current owner before sending.</p>':'')+permissionForm(job,email)
 return box('Customer review request',`${next}${consents.length?`<details><summary>Review permission history</summary><ul class="list">${consents.map(permissionHistory).join('')}</ul></details>`:''}${requests.length?`<ul class="list">${requests.map(requestHistory).join('')}</ul>`:''}`,{id:'reviews'})
}

export function customerReview(row:any,actionPath:string,submitted=false) {
 const invitation=`<p><a href="${e(row.reviewUrl)}">Leave a review on Google</a></p>`
 const rating=`<label>Your satisfaction rating<select name="rating" required><option value="">Choose a rating</option>${[1,2,3,4,5].map(value=>`<option value="${value}">${value} of 5</option>`).join('')}</select></label>`
 const feedback=row.response?.erasedAt?'<p>Private feedback erased.</p>':row.response||submitted?'<p role="status">Your private response was saved. Thank you for your feedback.</p>':row.withdrawnAt?'<p>Private feedback is closed after permission withdrawal.</p>':`<form method="post" action="${e(actionPath)}">${hidden('action','respond')}${rating}${area('Private feedback (optional)','feedback','','maxlength="2000" rows="4"')}<button>Send private feedback</button></form>`
 const withdrawal=row.withdrawnAt?'<p>Review email permission withdrawn.</p>':`<form method="post" action="${e(actionPath)}">${hidden('action','withdraw')}<button>Withdraw permission</button></form>`
 return `<div class="narrow">${box('Share your experience',`<p>You can leave a public Google review or send the shop private feedback. The Google invitation is available for every rating.</p>${invitation}${feedback}${withdrawal}`)}</div>`
}
