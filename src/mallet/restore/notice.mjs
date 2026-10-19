export const UNVERIFIED_ERASURE_HISTORY = 'Erasure history unverified: supply your latest archive as the journal.'
// Native CLI imports run this same product policy. The message is conditional
// because Base's staged-policy hook does not receive the caller's later journal.
export function explainErasureFreshness() {
 console.warn('Mallet restore: if no later source evidence was supplied, '+UNVERIFIED_ERASURE_HISTORY)
 return true
}
