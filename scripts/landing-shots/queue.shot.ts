/**
 * The queue screens of the two newer salon types (website brief 5.4) for their "Which salon are you?" cards: a demo
 * unisex salon and a demo beauty & wellness studio with a few people waiting, on a phone. Writes
 * assets/images/landing/<type>-queue.png (then to-webp.py → 600 × 1298 WebP).
 * Run against a production build (no development tools on screen): npm run build:web:local, then
 * node scripts/serve-web.mjs 8300 and E2E_PORT=8300 npx playwright test -c scripts/landing-shots/playwright.config.ts queue
 */
import { createOwner } from '../../e2e/support/api';
import { expect, test } from '../../e2e/support/fixtures';
import { signInOwner, tab } from '../../e2e/support/ui';

const SALONS = [
  { mode: 'unisex', name: 'Marina Cuts', guests: [['Omar', "Men's Haircut"], ['Sara', 'Blow-dry'], ['Guest', 'Beard Trim']] },
  { mode: 'wellness', name: 'Calm Studio', guests: [['Layla', 'Manicure'], ['Nadia', 'Lash Lift'], ['Guest', 'Pedicure']] },
] as const;

for (const salon of SALONS) {
  test(`${salon.mode} queue`, async ({ browser }) => {
    const owner = await createOwner(salon.mode, { businessName: salon.name });
    const { data: services } = await owner.client.from('services').select('id, name').eq('business_id', owner.businessId);
    for (const [guest, service] of salon.guests) {
      const id_ = services!.find((s) => s.name === service)!.id;
      const { error } = await owner.client.rpc('create_appointment', { p: { branch_id: owner.branchId, kind: 'walk_in', guest_name: guest, service_ids: [id_] } });
      if (error) throw error;
    }
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'en-US', timezoneId: 'Asia/Dubai' });
    const page = await ctx.newPage();
    // This device has picked the type; straight to the sign-in.
    await page.addInitScript((mode) => localStorage.setItem('device.salonType', mode), salon.mode);
    await page.goto('/sign-in');
    await signInOwner(page, owner.email, owner.password);
    await tab(page, 'queue');
    await expect(page.getByText(salon.guests[0][0], { exact: true }).first()).toBeVisible();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `assets/images/landing/${salon.mode}-queue.png` });
    await ctx.close();
  });
}
