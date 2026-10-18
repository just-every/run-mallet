A repair in Mallet follows the job across the counter: book the vehicle in, price it, record exactly what the customer said yes to, record the work, and hand over with one invoice. Each step is a button on the job's page, and each one is recorded with who did it and when.

The example below uses a 2017 Toyota Corolla in for an oil service. Prices and invoices are in USD. Before the first estimate, enter your shop's sales tax rate during setup or open **Sales tax** at `/app/tax`. Parts start taxable and labor exempt; choose the treatment that applies to your shop. Mallet does not look up state or county rates.

## 1. Add the customer's vehicle

In **Customers**, fill in **New repair order**:

- **Customer name** and **Customer email**.
- **Vehicle**: what it is, such as `2017 Toyota Corolla`.
- **Plate or VIN**: the license plate or VIN. It must be unique in your register.

Press **Add vehicle**. Mallet opens the vehicle's page.

## 2. Book in a visit

On the vehicle's page, use **Book in a visit**:

- **Repair request**: what the customer asked for, such as `Oil service`.
- **Bay**, and the **Technician**, chosen from the workshop's people.
- **Start (with timezone)** and **End (with timezone)**, written like `2026-10-19T09:00:00-04:00` (9 am Eastern daylight time).

Press **Book visit**. Mallet refuses the booking if it overlaps another open job in the same bay or with the same technician, and shows each overlapping job with a link and a way back to the booking form. [Bookings and service history](/docs/bookings-and-history) has more on times and technicians.

## 3. Prepare the estimate

The job's page opens with **Estimate & customer authorization**. **Prepare estimate** takes one part line and one labor line:

- **Part description**, **Part quantity** and **Part unit price (before tax)**.
- **Labor description**, **Labor hours** and **Labor rate (per hour, before tax)**.
- **Notes**, if you want them.

Prices are entered before sales tax in USD. Mallet applies your configured rate to the taxable categories and shows sales tax separately. Each line's subtotal and tax round to cents before the totals are added. The estimate revision saves its rate and tax treatment, so changing the shop's settings later leaves it and its resulting invoice unchanged. Estimates with more lines (up to 100) come through the command API, usually from an agent; see [People, roles and agent keys](/docs/people-and-agents).

## 4. Approve and share it

Check the lines and press **Approve estimate**. This approves this exact revision and price.

Then **Open printable estimate** to print it or show it to the customer, and record how you shared it with **Shared by** (printed, email, in person or phone) and a **Handoff note**. Press **Record estimate shared**.

Mallet does not email the customer. **Record estimate shared** is your record that you handed it over.

If the job changes before the customer answers, use **Prepare a revised estimate**. A new revision needs approving and sharing again.

## 5. Record the customer's yes, line by line

When the customer answers, tick exactly the lines they said yes to. Unticked lines are declined. Then fill in:

- **Customer who authorized**.
- **Authorization method**: in person, phone, email reply or signed.
- **Authorization evidence / reference**: what they said and where, such as `Called 9:40, yes to oil and service`.

Press **Record customer authorization**. The estimate table now shows each line as **Authorized** or **Declined**, and the authorized total including tax. The authorized estimate is frozen; extra work is a new visit.

## 6. Record the work and complete the repair

Under **Parts & labor**, pick an **Authorized item**, enter the **Quantity used / hours worked** and an optional **Work note**, and press **Record parts or labor**. You can only record work against authorized lines, and never more than was authorized.

When the job is ready to hand over, press **Complete repair**.

## 7. Invoice and export once

Under **Handover invoice**:

1. **Prepare invoice** builds it from the recorded work at the authorized prices and frozen sales tax rate. Nobody types in a total.
2. **Approve invoice** approves that exact invoice.
3. **Export invoice once** saves the invoice as a CSV, numbered like `M-000001`.

**Download saved invoice CSV** gives you that saved file, every time. The unit price, subtotal, sales tax and total columns are named `UnitUSD`, `SubtotalUSD`, `SalesTaxUSD` and `TotalUSD`, and its `Currency` column reads `USD`. It is a plain Mallet CSV, not an import for any particular accounting product, so map it in your own accounting workflow.

## 8. Hand over

The job's **Visit history** lists every step with its time and who did it. The asset keeps the visit; its page shows **Every visit** and **Download service history CSV**.
