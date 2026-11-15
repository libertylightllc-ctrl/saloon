# Parts C–F — plan (payroll, attendance, wording, settings)

From the owner's brief SALOQO_APP_FIXES.md (9 Nov 2026). Already done earlier and not redone here: **D2** (long times read
"11 h 37 min") and **D3** ("Late · not in", "Absent") went live with Part A (#44); **E1** (old alerts end) went live
with Part B; the morning summary part of **E4** ("Sales: 1") went live with Part A (#45).

Rules kept throughout: no recorded money changes (approved and paid payroll, sales, closings stay as they are); every
text in all 7 languages with plurals and right-to-left; who may do what checked on the server; one item per commit.

## Part C — payroll and payslips

| Item | What changes | Database |
|---|---|---|
| C1 Pay by days employed | Staff get a **start date** (default: the day they were added) and a **leaving date** (set when removed, cleared if brought back), both on the staff form. Base pay = monthly salary × days employed in the month ÷ days in the month. The payroll line and payslip show "Days: 23 of 31". A month still in draft shows "out of date" and is worked out again; approved months never change. | New migration: the two dates, the pay rule, day counts on payroll lines |
| C2 Payslips | My pay and the owner's payslip show the salon, name and staff ID, the month, days worked and late days, base, commission, **tips this month**, bonuses, deductions, advances, net pay, and "To pay" or "**Paid on 3 Nov 2026**". **Download PDF** button. When marking a line paid, the owner or accountant can pick the date it was paid (today or an earlier day of an open month). | Migration: payslip details function; the paid date |
| C3 Payroll line adds up | "Base · Commission · **Bonus** · Deductions · Advances · To pay" (each only when not zero). | — |
| C4 Payroll alert | "Ready to approve" goes only to people who can approve (the owner), ends once approved or worked out again; the old ones still showing end now. The accountant no longer sees an Approve button the server refuses. | Migration |

## Part D — attendance

| Item | What changes | Database |
|---|---|---|
| D1 Open shifts | After each day ends, any shift still open is closed as **"No clock-out"** at the roster's end time (no roster: at the clock-in time, 0 hours). It shows in Home → Needs attention for the owner and manager ("2 missed clock-outs") and on Attendance, where they fix the real time (manager with a reason, as now). It never carries into the next day. | Migration: the "no clock-out" mark, the nightly close, fixing a closed one |

## Part E — notifications, wording and translation

| Item | What changes | Database |
|---|---|---|
| E2 Dates on Recent activity | "Today · 3:56 PM", "Yesterday · 12:02 AM", "31 Oct · 3:56 PM" — on Home and the audit trail alike. | — |
| E3 Activity in every language | Each kind of activity line (about 86: "Saved sale #1004", "Renamed the salon", "Approved payroll"…) gets its words in all 7 languages. The app recognises the line and shows it in the app's language, so **old lines are translated too**; anything new it doesn't know stays in English. A test checks every activity line the database writes has its words. | — |
| E4 Plurals | "1 day · 1 late" on Staff sales, "Counted 1 item", "Asked for the plan: 1 month" (with E3), in all 7 languages. | — |
| E5 AI support answers | Bold shows as bold (no asterisks). The assistant gets the real menu paths (salon code: More and More → Staff), the five login types and who can do what. | Support server function updated |
| E6 Help questions by login | Each login sees only questions that fit it (a stylist no longer sees plan, staff and delete-account questions). | — |
| E7 Stylists see refunds on their sales | Read-only: amount, reason, and what it changed for them (commission, tip). | Migration: stylists may read refunds of their own sales |
| E8 Small wording | Close history "Difference AED 0.00"; Home "vs yesterday AED 120.00"; Queue this week empty "Nothing booked this week."; Control summary adds "26 Oct not closed", is called "Control summary" for accountant and manager, and managers see it for their branches; journal titles "October 2026 payroll", "Cash close · 25 Oct 2026"; one name "Accounting" (tab, More row and page title); accountant payroll text fixed; Home quick actions only those the login can use; stylists' sales page "My sales"; commission hidden on Home when the rate is 0%. | Migration for the control summary (managers) and the commission rate on Home |

## Part F — settings checks

| Item | What changes | Database |
|---|---|---|
| F1 Phone numbers | One check everywhere (branch, setup, staff, customers, profile, booking page): the country's number length, not all one digit; saved with the country code (+974 5551 2345). The same check on the server for new and changed numbers. **Existing customer numbers** that are valid local numbers for the salon's country get the country code added (so returning clients are found again); anything that isn't a valid number is left as it is. | Migration |
| F2 VAT tab | Reports shows the VAT tab only while "Registered for VAT" is on. | — |
| F3 Change the salon code once | Owner, More → Staff: "Change salon code" with the warning "Every staff member must sign in with the new code." All staff logins move to the new code in one step (if one fails, none change). Allowed once. | Migration + a new server function |
| F4 Last sign-in | Each staff page: "Last signed in: 12 Nov · 9:14 AM" or "Never signed in". | — |

## How it goes out

Built and tested part by part on the test database, then one full test run (database, app, browser in both looks),
then the SQL for the new migrations is shown for the owner's OK before anything touches the live database.
