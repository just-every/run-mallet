Mallet has three roles for people and one kind of key for agents. People decide; agents only prepare work for a person to review.

## Roles

| Role | What they can do |
| --- | --- |
| Owner | Everything an admin can, plus download backups, restore and erase unused assets. |
| Admin | Manage jobs, approve estimates, dispatch plans and invoices, export invoices, move data in and manage agent keys. |
| Member | See the jobs assigned to them, with their assets and estimates, and record parts and labour on those jobs. |

Members cannot approve prices or export invoices.

## Invite your team

Invitations use Base's sign-in service, which Mallet includes. With an owner or admin session, in the same browser:

| Request | What it does |
| --- | --- |
| `GET /auth/operators` | Lists everyone and their operator IDs. |
| `POST /auth/invite` with `{"email":"sam@example.com","displayName":"Sam Patel","role":"member"}` | Invites a member (or `"admin"`). |
| `POST /auth/operator/role` with `{"operatorId":"…","role":"admin"}` | Changes a role. |
| `POST /auth/operator/status` with `{"operatorId":"…","status":"inactive"}` | Turns access off, or back on with `"active"`. |

These requests need your signed-in session and the app's exact address as their `Origin`, the same protection every Mallet form has. Invitations are emailed, so they need mail configured; while Mallet runs on your computer, mail is not sent. **Data & access** shows your own operator ID.

To assign a job to a member, enter their operator ID as the job's **Technician**. They then see that job and can record its work.

## Agent keys

An agent, such as an assistant that drafts estimates, works with a preparation key. In **Data & access**, under **Agent access**, enter an **Agent label** and press **Create preparation key**. Mallet shows the key once: copy it into the agent's private settings.

A preparation key:

- can read the workshop, including customer details, so keep it private;
- can prepare estimates, estimate revisions, dispatch plans and invoice drafts;
- cannot approve, share, record a customer's authorisation, record work, export, move data in, back up, restore or erase;
- expires after 30 days, and stops working at once when you press **Revoke key** or when the person who created it loses their role.

Everything an agent prepares waits for a person. The approval record names who prepared it and who approved it, and the exact revision they approved.

[Commands and API](/docs/agent-commands) lists every command an agent can send, with examples.
