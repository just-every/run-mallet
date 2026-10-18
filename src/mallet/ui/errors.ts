// What a refused request reads as on screen. APIs keep the machine code; people get a sentence and a way back.
import {e} from './common'

const sentences:Record<string,string>={
 manager_required:'Only the shop owner and service advisors can open this.',
 owner_required:'Only the shop owner can do this.',
 post_required:'This address only takes a form. Go back and use its button.',
 method_not_allowed:'This address only takes a form. Go back and use its button.',
 form_required:'Send this from its form in Mallet.',
 json_required:'Send this from its form in Mallet.',
 confirmation_required:'Type the confirmation the form asks for, then try again.',
 agent_label_required:'Give the agent key a label, then try again.',
 invalid_json:'Mallet could not read that request. Try again from the form.',
 body_too_large:'That is too large to send in one go.',
 invalid_origin:'Nothing was changed: the request came from another site. Open Mallet at its own address and try again.',
 invalid_host:'Nothing was changed: the request came from another site. Open Mallet at its own address and try again.',
 unknown_command:'Mallet does not know that action.',
}
// A message written for people (a sentence) shows as it is; a bare code shows its sentence, or a plain fallback.
export function errorMessage(code:string,message:unknown) {
 const text=String(message??'')
 return sentences[code]??(/\s/.test(text)?text:'The action could not be completed. Check what you entered and try again.')
}
export const notFound=()=>`<section class="card empty-board"><img src="/brand/mark.svg" alt="" width="64" height="64"><h2>We can’t find that page</h2><p>The link may be incomplete, or the page has moved.</p><a class="button primary" href="/app">Back to the board</a></section>`
export const refused=(message:string,details:string,moveIn:boolean)=>`<section class="card"><p role="alert">${e(message)}</p>${details}<p class="card-foot"><a href="${moveIn?'/app/move-in':'/app'}">${moveIn?'Back to Move in':'Back to the board'}</a></p></section>`
