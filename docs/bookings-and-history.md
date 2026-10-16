Every vehicle, bicycle or device in Mallet keeps all of its visits. Bookings are checked against your bays and technicians so two jobs never claim the same bench at once.

## Times

Booking times are written with their timezone, for example `2026-10-19T09:00:00+11:00` for 9 am in Sydney during daylight saving, or `2026-10-19T09:00:00+08:00` in Perth. Mallet stores the exact moment and shows it in your browser's own timezone as `19 Oct, 9:00 – 10:00`.

A booking must end after it starts and last no more than seven days.

## Bays and technicians

**Bay** and **Technician** are free text: `Bay 2`, `Bench 3`, `Alex Nguyen`. Mallet refuses a booking that overlaps another open job in the same bay, or with the same technician. Completed and invoiced jobs no longer block anyone.

To let a member of your team see a job and record its work, enter their **operator ID** as the technician rather than their name. [People, roles and agent keys](/docs/people-and-agents) shows where to find it.

## Every visit

The asset's page lists **Every visit** with its status:

| Status | Meaning |
| --- | --- |
| `booked` | Booked in, not started. |
| `working` | Parts or labour have been recorded. |
| `completed` | The repair is done and ready to invoice. |
| `invoiced` | The invoice has been exported. |

Booking another visit keeps the earlier ones. **Download service history CSV** downloads the asset's whole history: every visit and every recorded step.

## Dispatch changes

An agent can prepare a change to a job's bay, technician or time, with its reason. It appears on the job under **Prepared dispatch plans**. When you press **Approve dispatch plan**, Mallet checks the bay and technician are still free before it moves the job.
