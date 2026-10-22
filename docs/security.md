# Second factors, step-up and customer links

Sign-in itself is Base's: an emailed one-time link opens a native session. Mallet adds a second factor on top of it, a fresh
confirmation for the actions that move money or authority, and shared protection for every private customer link.

## Second factors

Open **Data & access → Open security** (`/app/security`). A person can enrol:

- an **authenticator app** (time-based six-digit codes, thirty-second steps). The key is shown to the person once and kept sealed
  with a key derived from the installation's session secret; a code works once;
- a **passkey** (WebAuthn, ES256, user verification required). The server checks the exact origin, relying party, challenge,
  signature and a rising signature counter; a repeated counter is treated as a cloned authenticator;
- **recovery codes**: eight single-use codes issued with the first factor. A code opens one sign-in; it never counts as a fresh
  confirmation for money actions.

Once a person has a factor, every new sign-in of theirs must confirm it before anything else opens, including Base's own
`/auth/*` account routes. Their other open sessions end when they enrol their first factor. Wrong guesses are paced: eight misses
in fifteen minutes pause that person's confirmations, even for the right code.

### Owner-required policy

The owner can require a second factor for **every** person (Shop policy on the same page). The owner must hold a factor first.
New-install setup prompts the owner to enrol their own factor. People without one can then do nothing but set one up. The default is optional: only people who set one up are asked.

### Lost devices and owner recovery

- A recovery code opens one sign-in.
- The owner resets another person's factors; that person's sessions end and they enrol again.
- If the owner loses every factor and code, an operator with the shop's Cloudflare credentials runs `rer signin`. The one-time link
  it prints opens a session that may do one thing: **reset the owner's own factors** (their other sessions end), then enrol again.
  No email-only reset exists. Recovery is audited and creates a durable Security notice for every other active owner/admin, with one email and its recorded delivery outcome.

## Step-up

These commands need a confirmation from the last five minutes, from the same session, even for a signed-in owner:
`credit.issue`, `credit.apply`, `credit.exchange`, `refund.record`, `refund.redirect`, `refund.submit`, `refund.reconcile`
(refunds and credits), `return.override` (releasing a vehicle unpaid), `agent.create`, `asset.erase` and `intake.secretReveal`.
A refused command writes nothing; a person at a form is taken to confirm and returned to repeat it. Agent keys can never hold a
confirmation. A person without a factor must sign in again; an existing cookie and the initial setup session never silently pass. The new sign-in confirms privileged actions for five minutes. Credential save/rotate/revoke always requires an enrolled factor. Local development sessions behind the dev key gate are exempt, as in Base.

## Customer links

Approval, inspection, intake, check-in and appointment-management links, and customer sign-in links, are bearer links. Each door
shows an unknown, revoked or expired link the same page, with no customer detail, and a client that keeps missing is paused for
fifteen minutes per door. A link grants only its own scope: customer billing needs a customer account session
(`PORTAL-001`). Staff can withdraw an appointment-management link (`booking.revokeLink`); those links also lapse a day after the
appointment ends. Separating that appointment-management authority from read-only status access remains a GOV-004 Gap involving the ct-owned BOOK-002 flow. Approval links are single-purpose, revocable and expire no later than seven days after creation. A decision consumes their authority; receipt access also ends at expiry or revocation. Media links default to seven days; only the owner can extend them, to at most 31 days. A media link opens a separate five-minute authorized byte URL, rechecking the parent link on every read. Payment-link authority has no implemented door and remains a named GOV-004 gap.

Second-factor material, recovery-code hashes, sessions and link tokens are credentials: none is ever archived or written to the audit trail
(`mallet:*` rows in the auth audit record who enrolled, removed, reset or used a recovery code, never a secret).
