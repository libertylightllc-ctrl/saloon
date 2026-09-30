/**
 * Launch items (owner, 2026-09-30): the purchase entry laid out like the supplier's invoice (packs, unit price,
 * VAT 5%, total; subtotal, VAT, grand total, paid, supplier balance; PUR-00001; printed); the privacy policy and terms
 * open to everyone; deleting one's own account.
 */
import { admin, createOwner, createStaff, staffEmail, stockQty, userClient } from './support/api';
import { expect, test } from './support/fixtures';
import { expectMoney, id, ownerOn, signInOwner, snap, staffOn, tab, text } from './support/ui';

test('a purchase entered like the supplier’s invoice: 10 bottles of 1 L, delivery, part paid by card', async ({
  page,
  mode,
}) => {
  const owner = await createOwner(mode, { vat: true });
  await owner.client.rpc('save_item', {
    p: {
      business_id: owner.businessId,
      name: 'Hair colour 1 L',
      kind: 'consumable',
      unit: 'ml',
      pack_size: 1000,
    },
  });
  await owner.client.rpc('save_supplier', {
    p: { business_id: owner.businessId, name: 'Gulf Salon Supplies', terms_days: 30 },
  });

  await ownerOn(page, mode, owner.email, owner.password);
  await page.goto('/purchases/new');
  await id(page, 'bill-supplier-Gulf Salon Supplies').click();
  await id(page, 'bill-invoice').fill('INV-7781');
  await id(page, 'bill-payment-card').click();
  await id(page, 'bill-add-item').click();
  await id(page, 'bill-item-Hair colour 1 L').click();
  await id(page, 'bill-line-qty-0').fill('10');
  await id(page, 'bill-line-price-0').fill('45');
  await expect(id(page, 'bill-line-vat-0')).toHaveValue('22.50');
  await expectMoney(page, 'bill-line-total-0', 47_250);
  await expect(id(page, 'bill-line-stock-0')).toContainText('10000 ml into stock');
  await id(page, 'bill-add-other').click();
  await id(page, 'bill-line-desc-1').fill('Delivery');
  await id(page, 'bill-line-price-1').fill('20');
  // Subtotal 470.00 + VAT 23.50 = 493.50; 200.00 paid by card leaves 293.50 owed to the supplier.
  await expectMoney(page, 'bill-subtotal', 47_000);
  await expectMoney(page, 'bill-vat-total', 2350);
  await expectMoney(page, 'bill-total', 49_350);
  await id(page, 'bill-paid-amount').fill('200');
  await expectMoney(page, 'bill-paid', 20_000);
  await expectMoney(page, 'bill-balance', 29_350);
  await snap(page, 'bill-form-invoice', mode);
  await id(page, 'bill-save').click();

  await expect(text(page, 'PUR-00001 saved')).toBeVisible();
  await expectMoney(page, 'bill-detail-subtotal', 47_000);
  await expectMoney(page, 'bill-detail-vat', 2350);
  await expectMoney(page, 'bill-detail-total', 49_350);
  await expectMoney(page, 'bill-detail-paid', 20_000);
  await expectMoney(page, 'bill-detail-left', 29_350);
  await expect(id(page, 'bill-detail-line-0')).toContainText('10 × 1000 ml');
  expect(await stockQty(owner.branchId, owner.businessId, 'Hair colour 1 L')).toBe(10_000);
  await snap(page, 'bill-detail-invoice', mode);

  // Printed (a PDF on phones) in the same layout.
  await id(page, 'bill-print').click();
  const printed = () =>
    page.evaluate(
      () =>
        (document.querySelector('iframe[data-receipt]') as HTMLIFrameElement | null)
          ?.contentDocument?.body?.innerText ?? '',
    );
  await expect.poll(printed).toContain('PUR-00001');
  const paper = await printed();
  for (const part of [
    'Purchase entry',
    'Gulf Salon Supplies',
    'INV-7781',
    'Hair colour 1 L',
    'Grand total',
    'AED 493.50',
    'Supplier balance',
    'AED 293.50',
  ])
    expect(paper).toContain(part);

  // The books: stock at cost without VAT, VAT to claim back, the supplier owed the rest.
  const { data: lines } = await admin
    .from('journal_lines')
    .select(
      'debit_minor, credit_minor, accounts!inner(system_key), journal_entries!inner(source_type, business_id)',
    )
    .eq('journal_entries.business_id', owner.businessId)
    .eq('journal_entries.source_type', 'purchase_bill');
  const by = (key: string) =>
    (lines ?? [])
      .filter((l) => (l.accounts as unknown as { system_key: string }).system_key === key)
      .reduce((s, l) => s + l.debit_minor - l.credit_minor, 0);
  expect(by('inventory')).toBe(45_000);
  expect(by('supplies_expense')).toBe(2000);
  expect(by('vat_receivable')).toBe(2350);
  expect(by('supplier_payable')).toBe(-49_350);
});

test('the privacy policy and terms are open to everyone, from the landing page and sign-up', async ({
  page,
  mode,
}) => {
  await page.goto('/');
  await id(page, 'landing-privacy').click();
  await expect(id(page, 'legal-privacy')).toBeVisible();
  await expect(text(page, /Personal Data Protection Law/)).toBeVisible();
  await expect(text(page, /five years/).first()).toBeVisible();
  await snap(page, 'legal-privacy', mode);
  await id(page, 'legal-open-terms').click();
  await expect(id(page, 'legal-terms')).toBeVisible();
  await expect(text(page, /courts of Dubai/)).toBeVisible();

  await page.goto('/');
  await id(page, `welcome-${mode}`).click();
  await page.goto('/sign-up');
  await expect(
    text(page, 'By creating an account you agree to the terms and the privacy policy.'),
  ).toBeVisible();
  await id(page, 'sign-up-privacy').click();
  await expect(id(page, 'legal-privacy')).toBeVisible();
});

test('a barber deletes their login; then the owner deletes theirs, which closes the salon', async ({
  page,
  mode,
}) => {
  const owner = await createOwner(mode);
  const barber = await createStaff(owner, 'staff');

  await staffOn(page, mode, owner.code, barber.username, barber.password);
  await tab(page, 'more');
  await id(page, 'more-delete-account').click();
  await expect(id(page, 'delete-account-sheet')).toContainText('carries on without you');
  await expect(id(page, 'delete-account-submit')).toBeDisabled();
  await id(page, 'delete-account-confirm').fill('delete');
  await snap(page, 'delete-account-staff', mode);
  // The server switches the login off before it answers. Hold its answer back until the phone has already signed
  // itself out on hearing that (the order a busy server produces): the person must still be told the account was
  // deleted, never "This login is disabled".
  let seen: (text: string) => void = () => undefined;
  const firstNotice = new Promise<string>((resolve) => (seen = resolve));
  await page.route('**/functions/v1/delete-account', async (route) => {
    const response = await route.fetch();
    await expect(id(page, 'session-notice')).toBeVisible({ timeout: 15_000 });
    seen(await id(page, 'session-notice').innerText());
    // Signing out may have dropped the waiting request already; the server has done its work either way.
    await route.fulfill({ response }).catch(() => undefined);
  });
  await id(page, 'delete-account-submit').click();
  expect(await firstNotice).toBe('Your account has been deleted.');
  await expect(id(page, 'session-notice')).toHaveText('Your account has been deleted.');
  await page.unroute('**/functions/v1/delete-account');
  await expect(id(page, 'sign-in-submit')).toBeVisible();
  const { data: gone } = await admin
    .from('members')
    .select('active, display_name')
    .eq('id', barber.memberId)
    .single();
  expect(gone).toEqual({ active: false, display_name: 'Deleted user' });
  await expect(
    userClient(staffEmail(owner.code, barber.username), barber.password),
  ).rejects.toThrow();

  await signInOwner(page, owner.email, owner.password);
  await tab(page, 'more');
  await id(page, 'more-delete-account').click();
  await expect(id(page, 'delete-account-sheet')).toContainText('This closes');
  await expect(id(page, 'delete-account-backup')).toBeVisible();
  await id(page, 'delete-account-confirm').fill('DELETE');
  await id(page, 'delete-account-submit').click();
  await expect(text(page, 'Your account has been deleted.')).toBeVisible();
  await expect(id(page, 'sign-in-submit')).toBeVisible();
  const { data: business } = await admin
    .from('businesses')
    .select('closed_at')
    .eq('id', owner.businessId)
    .single();
  expect(business!.closed_at).not.toBeNull();
  const { count } = await admin
    .from('members')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', owner.businessId)
    .eq('active', true);
  expect(count).toBe(0);
  await expect(userClient(owner.email, owner.password)).rejects.toThrow();
});
