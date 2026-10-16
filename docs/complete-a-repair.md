A repair in Mallet follows the job across the counter: book the asset in, price it, record exactly what the customer said yes to, record the work, and hand over with one invoice. Each step is a button on the job's page, and each one is recorded with who did it and when.

The example below uses a 2017 Toyota Corolla in for an oil service.

## 1. Add the customer's asset

In **Workshop**, fill in **Add a customer’s asset**:

- **Customer name** and **Customer email**.
- **Vehicle or device**: what it is, such as `2017 Toyota Corolla`, `2019 Trek FX 3` or `iPhone 13`.
- **Registration or serial**: the rego, frame number or serial. It must be unique in your register.

Press **Add asset**. Mallet opens the asset's page.

## 2. Book in a visit

On the asset's page, use **Book in a visit**:

- **Repair request**: what the customer asked for, such as `Oil service`.
- **Bay** and **Technician**.
- **Start (with timezone)** and **End (with timezone)**, written like `2026-10-19T09:00:00+11:00`.

Press **Book visit**. Mallet refuses the booking if it overlaps another open job in the same bay or with the same technician, and lists the overlapping job. [Bookings and service history](/docs/bookings-and-history) has more on times and technicians.

## 3. Prepare the estimate

The job's page opens with **Estimate & customer authorisation**. **Prepare estimate** takes one part line and one labour line:

- **Part description**, **Part quantity** and **Part unit price (AUD, excluding GST)**.
- **Labour description**, **Labour hours** and **Labour rate (AUD/hour, excluding GST)**.
- **Notes**, if you want them.

Prices are in Australian dollars excluding GST. Mallet adds 10% GST and shows it separately. Estimates with more lines (up to 100) come through the command API, usually from an agent; see [People, roles and agent keys](/docs/people-and-agents).

## 4. Approve and share it

Check the lines and press **Approve estimate**. This approves this exact revision and price.

Then **Open printable estimate** to print it or show it to the customer, and record how you shared it with **Shared by** (printed, email, in person or phone) and a **Handoff note**. Press **Record estimate shared**.

Mallet does not email the customer. **Record estimate shared** is your record that you handed it over.

If the job changes before the customer answers, use **Prepare a revised estimate**. A new revision needs approving and sharing again.

## 5. Record the customer's yes, line by line

When the customer answers, tick exactly the lines they said yes to. Unticked lines are declined. Then fill in:

- **Customer who authorised**.
- **Authorisation method**: in person, phone, email reply or signed.
- **Authorisation evidence / reference**: what they said and where, such as `Called 9:40, yes to oil and service`.

Press **Record customer authorisation**. The estimate table now shows each line as **Authorised** or **Declined**, and the authorised total including GST. The authorised estimate is frozen; extra work is a new visit.

## 6. Record the work and complete the repair

Under **Parts & labour**, pick an **Authorised item**, enter the **Quantity used / hours worked** and an optional **Work note**, and press **Record parts or labour**. You can only record work against authorised lines, and never more than was authorised.

When the job is ready to hand over, press **Complete repair**.

## 7. Invoice and export once

Under **Handover invoice**:

1. **Prepare invoice** builds it from the recorded work at the authorised prices. Nobody types in a total.
2. **Approve invoice** approves that exact invoice.
3. **Export invoice once** saves the invoice as a CSV, numbered like `M-000001`.

**Download saved invoice CSV** gives you that saved file, every time. The CSV has AUD unit prices, subtotal, GST and total columns. It is a plain Mallet CSV, not an import for any particular accounting product, so map it in your own accounting workflow.

## 8. Hand over

The job's **Visit history** lists every step with its time and who did it. The asset keeps the visit; its page shows **Every visit** and **Download service history CSV**.
