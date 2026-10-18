Every vehicle, bicycle or device in Mallet keeps all of its visits. Bookings are checked against your bays and technicians so two jobs never claim the same bench at once.

## Times

Booking times are written with their UTC offset, for example `2026-10-19T09:00:00-04:00` for 9 am in Columbus, Ohio, during daylight saving time, or `2026-10-19T09:00:00-07:00` in Los Angeles. Mallet stores the exact moment and shows it in your browser's own timezone, with the timezone's name, as `Oct 19, 9:00 am – 10:00 am EDT`. Eastern time is `-04:00` from March to early November and `-05:00` the rest of the year; Arizona stays on `-07:00` all year.

A booking must end after it starts and last no more than seven days.

## Bays and technicians

**Bay** is free text: `Bay 2`, `Bench 3`. **Technician** is a list of the workshop's people, owners, admins and members, including those invited who have not yet signed in. Choose a person and Mallet saves their operator ID, so a member sees that job and can record its work, and shows their name on jobs, dispatch plans and the workshop list.

Mallet refuses a booking that overlaps another open job in the same bay, or with the same technician. It shows each clashing visit with a link, and **Back to the booking form** returns you to the form with what you entered. Completed and invoiced jobs no longer block anyone.

Over the API a technician is an operator ID; see [People, roles and agent keys](/docs/people-and-agents).

## Every visit

The asset's page lists **Every visit** with its status:

| Status | Meaning |
| --- | --- |
| `booked` | Booked in, not started. |
| `working` | Parts or labor have been recorded. |
| `completed` | The repair is done and ready to invoice. |
| `invoiced` | The invoice has been exported. |

The workshop's **Repair jobs** list shows open jobs first, earliest start first, each with its estimate or invoice stage beside its status (for example `estimate sent` while you wait for the customer). Invoiced visits follow, most recent first.

Booking another visit keeps the earlier ones. **Download service history CSV** downloads the asset's whole history: every visit and every recorded step.

## Dispatch changes

An agent can prepare a change to a job's bay, technician or time, with its reason. It appears on the job under **Prepared dispatch plans**. When you press **Approve dispatch plan**, Mallet checks the bay and technician are still free before it moves the job.
