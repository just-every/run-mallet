The company MCP door, supported preparation tools and current adoption limits are documented in [Company agents in Mallet](/docs/agent-door). Original preparation-key REST calls enter that same policy pipeline and require an answered policy.

Mallet has three base roles for people, preparation keys and separate scoped assistant grants. People decide; each assistant receives only its explicitly granted work.

## Roles

| Role | What they can do |
| --- | --- |
| Owner | Everything an admin can, plus download backups, restore and erase unused assets. |
| Admin | Manage jobs and quality checklists; make independent quality decisions/overrides when not the assigned technician; approve estimates, dispatch plans and invoices, export invoices, move data in and manage agent keys. |
| Member | See the jobs assigned to them, with their assets and estimates, and record parts and labor, quality check results/corrective work and technician sign-off on those jobs. |

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

To assign a job to a member, choose them as the visit's **Technician** in **Book in a visit**: the list shows everyone invited or active. They then see that job and can record its work. Over the API, `technicianId` is their operator ID.

## Agent keys

An agent, such as an assistant that drafts estimates, works with a preparation key. In **Data & access**, under **Agent access**, enter an **Agent label** and press **Create preparation key**. Mallet shows the key once: copy it into the agent's private settings.

A preparation key:

- can read the workshop, including customer details, so keep it private;
- can prepare estimates, estimate revisions, dispatch plans and invoice drafts;
- cannot approve, share, record a customer's authorization, record work, export, move data in, back up, restore or erase;
- expires after 30 days, and stops working at once when you press **Revoke key** or when the person who created it loses their role.

Everything an agent prepares waits for a person. The approval record names who prepared it and who approved it, and the exact revision they approved.

[Commands and API](/docs/agent-commands) lists every command an agent can send, with examples.


## Scoped assistants

The current owner opens **Data & access → Assistant settings** to create a separate receptionist, note-polishing or reviewed-email key. Choose one service, repair or requested tentative appointment, exact start and expiry, and an explicit reason. Every grant has zero spending authority. Only a reviewed appointment email permits an outbound channel. Copy the key once into private assistant configuration.

The assistant uses its scoped tool API, identifies the AI interaction and offers a human handoff. Receptionist intake reserves existing capacity after recording the customer's request; it does not authorize repairs. Diagnostic wording is a proposal alongside the complete raw technician evidence and measurements. A person records approval or rejection without rewriting the source. The owner separately reviews the exact email recipient and content. Revocation stops queued messages, and failure or uncertainty never triggers an automatic retry.

An archive preserves these decisions and proposals but excludes assistant keys. A restored grant is historical and cannot run. These interim defaults await policy approval under ADV-008; a conversational model connection and broader channels are not included.
