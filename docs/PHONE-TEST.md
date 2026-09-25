# 10-minute two-phone test (M1)

Two phones, both with **Expo Go** installed, on the **same Wi-Fi as the Mac**.
Phone A is the owner, phone B the cashier. Ticks ✅ are what you should see.

## Before you start (on the Mac, 2 minutes)

```bash
npx supabase start
```

```bash
npx expo start
```

Scan the QR code from the second command with both phones (iPhone: Camera app · Android: Expo Go).
If a phone cannot connect, the Mac's firewall is blocking it: System Settings → Network → Firewall →
allow incoming connections for "node", or switch the firewall off for the test.

## 1 · Owner sign-up and setup (phone A, 2 min)

1. Tap **Gents salon**. ✅ The sign-in turns violet.
2. **New here? Create an owner account**: your name, an email, a password (8+), confirm → **Create account**.
3. Setup wizard: business name → Next → UAE → Next → **Gents** is already picked → Next →
   branch name → Next → leave VAT off, **Cash in the drawer now** `200` → **Create my salon**.
4. ✅ Home: "Good morning/afternoon, <you>", **Expected cash today AED 200.00**, sales AED 0.00,
   "No one is waiting", "Finish setting up".

## 2 · Cashier login (A creates, B signs in, 2 min)

1. A: **More → Team & logins**. Note the **salon code** (e.g. `testgents`). **New** → name `Faisal`,
   role **Cashier**, username `faisal`, password `Cash1234!` → **Create login**.
2. B: tap **Ladies salon & spa** on purpose → **Staff** tab → salon code, `faisal`, `Cash1234!` → **Sign in**.
3. ✅ B turns **violet** (the branch is gents), tabs: Home · Queue · Sale · Customers · More.
   B's More has **no** Team or Branch settings.

## 3 · Walk-in, live on both phones (2 min)

1. Both phones on the **Queue** tab.
2. B: **New** → **New** (customer) → name `Omar`, phone `0501234567` → **Add customer** →
   tap **Haircut** → **Add to queue**.
3. ✅ Within about 2 seconds Omar appears on **A without touching it**.
4. A: **Start** → ✅ B shows Omar "in progress". A: **Complete**.
5. ✅ A opens Quick sale with Haircut AED 25.00 in the basket. **Checkout** → customer Omar is
   filled in → **Cash** → **Save sale · AED 25.00**. ✅ A green tick: "Sale #1001 saved".
6. ✅ Both Homes: Sales today **AED 25.00**, Expected cash **AED 225.00**.

## 4 · Split, discount, tip (A, 1 min)

Sale tab → add Haircut twice → Checkout → Discount `10` → Tip `5` → **Split** → Cash `20`, Card `25`.
✅ "Left to allocate AED 0.00", Save enabled → save → ✅ total AED 45.00.

## 5 · Refund rules (1 min)

1. B: More → Sales → sale #1001. ✅ **No** Refund button for the cashier.
2. A: More → Sales → #1001 → **Refund** → amount `10`, reason `Test refund` → **Refund AED 10.00**.
   ✅ "Part refunded", the reason is shown, and Home's expected cash drops by 10.

## 6 · Switch the salon type live (1 min)

A: More → **Branch settings** → tap **Ladies salon & spa** → **Switch to Ladies salon & spa**.
✅ **Both** phones turn coral within a few seconds; B's New walk-in says "Any stylist" instead of
"Any barber". Switch back to Gents.

## 7 · Disabled login (1 min)

1. A: More → Team & logins → Faisal → **Disable login**.
   ✅ B is signed out by itself: "This login is disabled. Ask the owner."
2. A: **Enable login** again; B can sign in again (salon code is remembered).

## 8 · Owner's books (A, 1 min)

A: More → **Accounts & history**. ✅ Overview: opening cash + cash sales − cash refunds = the same
expected cash as Home; card payments are not in it. ✅ Trial balance says **Balanced: Yes**.
✅ Journal lists the sales and the refund; tap one to see its debit and credit lines.
✅ History shows "Saved sale #1001…" and the sign-ins. B (cashier): More has **no** Accounts & history.

## 9 · Arabic (optional, 1 min)

A: More → Language → **العربية**. ✅ The layout flips right-to-left, day and month names are Arabic
("الجمعة 25 سبتمبر"), numbers stay 0-9.

## 10 · Sign out

A: More → **Sign out** → ✅ back on the sign-in, still in the salon's colours.

If anything does not match a ✅, note the step number and what you saw.
