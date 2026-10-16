Mallet runs entirely on your own computer, and that is all most shops need to start. When you want it reachable from the counter, the workshop floor and your phone, you can put the same app in your own Cloudflare account. Everything it creates belongs to your account.

## What you need

- A Cloudflare account with a registered `workers.dev` subdomain.
- An account API token with **Workers Scripts: Edit** and **D1: Edit**.
- A Resend account and a verified sender address, so Mallet can email sign-in links and invitations.
- Mallet set up locally first, as in [Get started](/docs/getting-started).

Mallet declares one D1 database.

## Settings

Give these privately, in your environment or in a private file passed with `--env-file`. Never put them in the code or on the command line.

| Setting | What it is |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID. |
| `CLOUDFLARE_API_TOKEN` | The API token above. |
| `OWNER_EMAIL` | The owner's email address. |
| `SESSION_SECRET` | A long random secret for sign-in sessions. |
| `SETUP_TOKEN` | A long random token that protects the first owner claim. |
| `MAIL_API_KEY` | Your Resend API key. |

Replace the example `MAIL_FROM` in `deploy.json` with your verified sender.

## Deploy

```sh
rer deploy --dry-run
rer deploy
```

The dry run builds and checks everything locally without contacting Cloudflare. The real deploy creates the database and the Worker, applies the database migrations and checks that the app answers.

## Keep the deploy record

`rer deploy` writes `.rer/deploy/<environment>.json`. It records which Cloudflare resources belong to this installation, so the next deploy updates them instead of creating new ones. Keep it out of Git and back it up: a fresh clone without it cannot safely take over an existing deployment.

To move your local workshop into the deployed one, use a backup: see [Back up, restore and erase](/docs/backup-and-restore).
