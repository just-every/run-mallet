import type { MailSender } from './modules/operator-auth/index.mjs'
import type { Bindings } from './auth.server'
type MailMessage = Parameters<MailSender['send']>[0] & {
 attachments?: Array<{filename:string;contentType:string;content:Uint8Array}>
}
export function operatorMail(env: Bindings): {send(message:MailMessage):ReturnType<MailSender['send']>} | undefined
