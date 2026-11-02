# Connectors and provider credentials

Mallet talks to four outside services. `/connectors` (no sign-in needed) publishes, for each, what Mallet sends, what comes back,
what is kept, whose licence applies and who may trigger it, and the owner reads that before saving a credential.

| Connector | Used for | Credential | Rotated in Mallet |
| --- | --- | --- | --- |
| Stripe | Confirming captured payments; refunds you reviewed | Restricted API key | Yes |
| Pier | Reading the parts catalog | Pier session | Yes |
| Email delivery events | Signed delivered / deferred / bounced notices | Webhook signing secret | Yes |
| Email sending | Sign-in links, approvals, confirmations, reports | Sending key | No: set it in your Cloudflare account |

## Saving, rotating and revoking

The owner opens **Data & access → Connectors** (`/app/connectors`), reads the declaration, ticks that they have, and saves the new
credential after enrolling their own factor and giving a fresh second-factor confirmation (see `docs/security.md`). Only a short fingerprint is ever shown again. Saving
over an existing credential replaces it for good; the next provider call uses the new one. **Revoke** makes the credential unavailable to every
call, even if your deployment still holds the old value, until you save another. Until you do either, Mallet uses the value your
deployment was configured with. Agent preparation keys rotate with `agent.rotate`: the new key replaces the old in one step.

## Webhooks

The email delivery intake accepts a notice only with a valid signature from the current signing secret, a fresh timestamp, and a
message and one recipient that Mallet itself sent. A replaced, wrong, stale or replayed signature changes nothing.

## What is never stored in the clear

Sealed credentials are excluded from backups, and no credential reaches a page, an API answer, the audit trail or the Worker log.

## Private media

A scoped link defaults to seven days. Only an owner may extend it to the 31-day ceiling, and staff may revoke it. Each reviewed file opens a separate five-minute authorized byte URL; expired, tampered, revoked or cross-customer requests return no bytes. Live staff access checks the job rights.

The deployment email sending key cannot yet be rotated or revoked in Mallet. GOV-005 remains partial until data-flow and licensing declarations are confirmed for every enabled connector.
