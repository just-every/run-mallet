export type ReminderPayload = {chaseId:string;step:number;linkId:string;jobId:string}
export type Outcome = {status:'accepted'|'development'|'rejected'|'rate_limited'|'unavailable'|'uncertain'|'skipped';provider:string;providerMessageId:string|null}
export type JobStatus = 'pending'|'leased'|'dispatching'|'succeeded'|'failed'|'uncertain'|'resolved'
export type PaymentCheckPayload={invoiceId:string;version:number;paymentIntentId:string;requestedBy:{id:string;name:string;version:number};consentEvidence:string}
export type Job = {id:string;event_key:string;kind:'approval-reminder'|'stripe-payment-check';payload:string;due_at:number;status:JobStatus;lease_token:string|null;lease_until:number|null;attempts:number;dispatched_at:number|null;outcome:string|null;created_at:number;updated_at:number}
export type ReminderJob = Omit<Job,'payload'|'outcome'|'lease_token'> & {payload:ReminderPayload|PaymentCheckPayload;outcome:Outcome|null}
export const view=(row:Job):ReminderJob=>{const {lease_token,...safe}=row;return {...safe,payload:JSON.parse(row.payload),outcome:row.outcome?JSON.parse(row.outcome):null}}
export type Handler = (job:ReminderJob)=>Promise<Outcome>
export const LEASE_MS=60_000
export const MAX_CONCURRENCY=4
