/**
 * Every activity sentence the server writes (audit_log.summary, in English), so the app can show it in the reader's
 * language (owner's app check E3). Old rows are matched too, as they were worded then.
 *
 * `en` is the sentence with named values: `{name}` is any text, `{name:type}` a value of that type (see VALUE_TYPES);
 * `{part?}` is an optional piece whose English is in `parts`. The i18n keys are `activity.<key>.text` and
 * `activity.<key>.<part>`. Order matters: the first rule that matches wins, so the more specific come first.
 * A sentence no rule matches is shown as written. activityText.test.ts checks every sentence in the migrations.
 */
export interface ActivityRule {
  key: string;
  en: string;
  parts?: Record<string, string>;
}

/** What a typed value looks like, and how it is shown (activityText.ts). */
export const VALUE_TYPES = {
  time: '\\d{1,2}:\\d{2}',
  int: '-?\\d+',
  count: '-?\\d+',
  money: '-?[A-Z]{3} -?[\\d,]+(?:\\.\\d+)?',
  kind: '[Bb]onus|[Dd]eduction|[Aa]dvance',
  method: 'cash|bank|card',
  role: 'owner|manager|cashier|staff|accountant',
  mode: 'gents|ladies|unisex|wellness',
  items: 'items?',
  guest: '.+?',
  doc: '.+?',
  dayMon: '\\d{1,2} [A-Z][a-z]{2}',
  dayMonYear: '\\d{1,2} [A-Z][a-z]{2} \\d{4}|—',
  isoDate: '\\d{4}-\\d{2}-\\d{2}',
  period: '\\d{4}-\\d{2}',
} as const;
export type ValueType = keyof typeof VALUE_TYPES;

const BY = { by: ' — recorded by {by}' };
const FOR = { for: ' for {person}' };

export const ACTIVITY_RULES: readonly ActivityRule[] = [
  // Sales, refunds, customers, the queue
  { key: 'saleSaved', en: 'Saved sale #{number} · {amount:money}' },
  { key: 'saleRefunded', en: 'Refunded {amount:money} on sale #{number}: {reason}' },
  { key: 'refundRequested', en: 'Asked for a refund of {amount:money} on sale #{number}: {reason}' },
  { key: 'refundDeclined', en: 'Declined a refund request{note?}', parts: { note: ': {note}' } },
  { key: 'customerDeleted', en: "Deleted a customer's personal details: {reason}" },
  { key: 'customersMerged', en: 'Merged customer {from}{phone?} into {into}', parts: { phone: ' ({phone})' } },
  { key: 'walkInAdded', en: 'Added walk-in {name:guest}' },
  { key: 'bookedOnline', en: 'Booked online: {name}' },
  { key: 'booked', en: 'Booked {name:guest}' },
  { key: 'checkedIn', en: 'Checked in {name:guest}' },
  { key: 'serviceStarted', en: 'Started {name:guest}' },
  { key: 'noShow', en: 'Marked no-show {name:guest}' },
  { key: 'noShowUndone', en: 'Undid no-show for {name:guest}' },
  { key: 'cancelledOnline', en: 'Cancelled online by {name:guest}' },
  { key: 'appointmentCancelled', en: 'Cancelled {name:guest}: {reason}' },

  // Cash and the drawer
  { key: 'drawerFromBank', en: 'Added {amount} cash to the drawer from the bank' },
  { key: 'drawerFromOwner', en: 'Added {amount} cash to the drawer from the owner' },
  { key: 'openingCash', en: 'Set opening cash' },
  {
    key: 'closeSubmitted',
    en: 'Submitted cash close {day:dayMon}: counted {counted:money}, expected {expected:money}, difference {difference:money}',
  },
  { key: 'closeApproved', en: 'Approved cash close {day:dayMon} · difference {amount:money}' },
  { key: 'closeReturned', en: 'Sent cash close {day:dayMon} back: {reason}' },
  {
    key: 'depositBanked',
    en: 'Bank deposit {amount:money} from the {day:dayMon} close reached the bank on {banked:dayMon}{ref?}',
    parts: { ref: ' · {ref}' },
  },

  // Money out and the books
  { key: 'expenseRecorded', en: 'Expense {category} · {amount:money}' },
  { key: 'expenseReversed', en: 'Reversed expense {category} · {amount:money} — {reason}' },
  { key: 'expenseCategory', en: 'Expense category {name}' },
  { key: 'purchasePosted', en: 'Purchase {number} from {supplier} · {amount:money}' },
  { key: 'purchaseReversed', en: 'Reversed purchase {number} — {reason}' },
  { key: 'billPosted', en: 'Bill #{number} from {supplier} · {amount:money}' },
  { key: 'billReversed', en: 'Reversed bill #{number} — {reason}' },
  { key: 'supplierSaved', en: 'Supplier {name}' },
  { key: 'receiptAdded', en: 'Added a receipt photo' },
  { key: 'booksClosed', en: 'Closed the books for {month:period}' },
  { key: 'booksReopened', en: 'Reopened the books for {month:period}: {reason}' },

  // Stock and deliveries
  { key: 'stockAdjusted', en: 'Adjusted {item} by {qty} {unit}: {reason}' },
  { key: 'stockCounted', en: 'Counted {count:count} items, {changed:int} changed, value {amount:money}' },
  { key: 'openingStock', en: 'Counted opening stock' },
  { key: 'stockDifferenceFixed', en: 'Fixed the stock difference: {amount:money}' },
  { key: 'itemAdded', en: 'Added item {name}' },
  { key: 'itemUpdated', en: 'Updated item {name}' },
  {
    key: 'deliveryReceived',
    en: 'Delivery {number} received{from?}: {count:count} {items:items}, waiting for prices',
    parts: { from: ' from {supplier}' },
  },
  { key: 'deliveryPriced', en: 'Delivery {number} priced: {bill} · {amount:money}' },
  { key: 'deliveryCancelled', en: 'Delivery {number} cancelled: {reason}' },

  // Payroll
  { key: 'payrollGenerated', en: 'Generated payroll {month:period}: net {amount:money}' },
  { key: 'payrollApproved', en: 'Approved payroll {month:period}: net {amount:money}' },
  {
    key: 'salaryPaid',
    en: 'Paid {month:period} salary {amount:money} to {name} by {method:method}{on?}',
    parts: { on: ' on {date:isoDate}' },
  },
  { key: 'tipsPaid', en: 'Paid tips {amount:money} to {name}' },
  { key: 'supplierPaid', en: 'Paid {name} {amount:money}' },
  { key: 'adjustmentRecorded', en: '{kind:kind} {amount:money} for {name}{note?}', parts: { note: ': {note}' } },
  { key: 'adjustmentReversed', en: 'Reversed {kind:kind} {amount:money}: {reason}' },
  { key: 'wpsAdded', en: 'Added WPS transfer proof' },

  // Attendance
  {
    key: 'clockIn',
    en: '{name} clocked in at {time:time}{late?}{by?}',
    parts: { late: ' (late {minutes:int} min)', ...BY },
  },
  { key: 'clockOut', en: '{name} clocked out at {time:time}{by?}', parts: BY },
  { key: 'breakStart', en: '{name} started a break at {time:time}{by?}', parts: BY },
  { key: 'breakEnd', en: '{name} back from a break at {time:time} ({minutes:int} min){by?}', parts: BY },
  { key: 'resumed', en: '{name} back at work at {time:time} (had clocked out at {out:time}){by?}', parts: BY },
  { key: 'shiftClosed', en: '{name} did not clock out on {day:dayMon}: shift closed at {time:time}' },
  {
    key: 'missedClockOutFixed',
    en: "{name}'s missed clock-out on {day:dayMon} set to {time:time} by {by}{reason?}",
    parts: { reason: ': {reason}' },
  },
  { key: 'rosterUpdated', en: 'Updated the weekly roster of {name}' },

  // Staff and logins
  { key: 'staffAdded', en: 'Added staff {name}' },
  { key: 'staffUpdated', en: 'Updated staff {name}{salary?}', parts: { salary: ' (salary {from:money} → {to:money})' } },
  { key: 'staffRemoved', en: 'Removed {name} from the staff (no records)' },
  { key: 'staffArchived', en: 'Archived {name} (records kept; login off)' },
  { key: 'staffRestored', en: 'Brought {name} back to the staff' },
  { key: 'staffRecordsMerged', en: 'Merged the two records of {name} (Staff & payroll and Team & logins) into one' },
  { key: 'loginCreated', en: 'Created login {username} ({role:role}){for?}', parts: { for: ' for {name}' } },
  { key: 'loginTypeChanged', en: "Changed {name}'s login to {role:role}" },
  { key: 'passwordReset', en: 'Reset password for {name}' },
  { key: 'loginEnabled', en: 'Enabled login for {name}' },
  { key: 'loginDisabled', en: 'Disabled login for {name}' },
  { key: 'pinSet', en: 'Set a quick-switch PIN' },
  { key: 'pinLocked', en: "Manager approval: {name}'s PIN is locked (asked by {by})" },
  { key: 'profileUpdated', en: 'Updated their profile{name?}', parts: { name: ': name {from} → {to}' } },
  { key: 'loginDeleted', en: 'Deleted their own login' },
  { key: 'accountDeleted', en: 'The owner deleted their account; the salon is closed' },

  // The salon and its settings
  { key: 'salonSetUp', en: 'Set up {name}' },
  { key: 'salonRenamed', en: 'Renamed the salon: {from} → {to}' },
  { key: 'salonClosedByPlatform', en: 'Salon closed by the platform owner: {note}' },
  { key: 'branchAdded', en: 'Added the branch {name}' },
  { key: 'branchUpdated', en: 'Updated branch settings' },
  { key: 'modeSwitched', en: 'Switched salon type to {mode:mode}' },
  {
    key: 'countryChanged',
    en: 'Changed the country from {from} ({fromCurrency}, {fromZone}) to {to} ({toCurrency}, {toZone})',
  },
  { key: 'bookingOn', en: 'Online booking on: {slug}{was?}', parts: { was: ' (was {old})' } },
  { key: 'bookingOff', en: 'Online booking off{was?}', parts: { was: ' (was {old})' } },
  { key: 'coverOff', en: 'Took the cover photo off the booking page' },
  { key: 'coverOn', en: 'Put a cover photo on the booking page' },
  { key: 'instagramOff', en: 'Took Instagram off the booking page' },
  { key: 'instagramOn', en: 'Instagram on the booking page: @{handle}' },
  { key: 'logoOff', en: 'Took the logo off receipts' },
  { key: 'logoOn', en: 'Put a logo on receipts' },
  { key: 'roomAdded', en: 'Added the room {name}' },
  { key: 'roomStopped', en: 'Stopped using the room {name}' },
  { key: 'roomSaved', en: 'Room {name}' },
  { key: 'serviceSaved', en: 'Saved service {name}' },
  { key: 'controlChanged', en: 'Controls: {control} {from} → {to}' },
  { key: 'planRequested', en: 'Asked for the plan: {count:count} month(s)' },
  { key: 'pilotJoined', en: 'Joined the pilot with code {code}, free until {date:isoDate}' },
  { key: 'hygieneSigned', en: 'Signed the hygiene log: {done:int} of {total:int} done' },

  // Compliance records (after every other "Added …", since a record's name can be anything)
  { key: 'evidenceAdded', en: 'Added evidence for {doc:doc}' },
  { key: 'documentDeleted', en: 'Deleted {doc:doc}{for?} from the register{reason?}', parts: { ...FOR, reason: ': {reason}' } },
  { key: 'documentRestored', en: 'Put back {doc:doc}{for?}', parts: FOR },
  {
    key: 'documentEdited',
    en: 'Edited {doc:doc}{for?}{expiry?}',
    parts: { ...FOR, expiry: ': expires {from:dayMonYear} → {to:dayMonYear}' },
  },
  { key: 'documentRenewed', en: 'Renewed {doc:doc}{for?}{expires?}', parts: { ...FOR, expires: ', expires {date:dayMonYear}' } },
  { key: 'documentAdded', en: 'Added {doc:doc}{for?}{expires?}', parts: { ...FOR, expires: ', expires {date:dayMonYear}' } },
];
