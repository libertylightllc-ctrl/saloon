/**
 * The pilot and branches (full update, Phase 6): a salon applies for the pilot (as the website's form does); the
 * platform owner approves it in the console and gets a one-use code with a WhatsApp message ready; the owner types
 * the code at sign-up and the new salon is a pilot salon. An owner adds a branch — its price shown first, nothing
 * charged — opens it (the whole app follows), and the plan's bill counts each branch.
 */
import { createClient } from '@supabase/supabase-js';

import { admin, createOwner, makePlatformAdmin } from './support/api';
import { ANON_KEY, SUPABASE_URL, uid } from './support/env';
import { expect, test } from './support/fixtures';
import { field, id, ownerOn, tab, text } from './support/ui';

test('a pilot application is approved with a code; the owner signs up with it and the salon is a pilot salon', async ({ page, mode, device }) => {
  const salon = `Pilot Salon ${uid().slice(-5)}`;
  // Each run applies from an address of its own (the form allows 3 an hour from one address).
  const address = `198.51.100.${Math.floor(Math.random() * 250) + 1}, 10.${Date.now() % 250}.0.1`;
  const visitor = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false }, global: { headers: { 'x-forwarded-for': address } } });
  const { data: applied, error } = await visitor.rpc('apply_for_pilot', {
    p: { name: 'Mariam', salon_name: salon, emirate: 'dubai', area: 'Al Wasl', salon_type: 'ladies', staff_count: 6,
         whatsapp: '+971501234567', language: 'en', whatsapp_ok: true },
  });
  expect(error).toBeNull();
  expect(applied).toMatchObject({ ok: true });

  const platform = await createOwner(mode);
  await makePlatformAdmin(platform.email);
  const office = await device();
  await ownerOn(office, mode, platform.email, platform.password);
  await office.goto('/admin');
  await id(office, 'console-tab-pilot').click();
  await expect(id(office, `pilot-app-${salon}`)).toContainText('Ladies salon');
  await id(office, `pilot-approve-${salon}`).click();
  const message = id(office, 'console-pilot-message');
  await expect(message).toContainText('welcome to the Saloqo pilot');
  const code = /PILOT-[A-Z0-9]+/.exec((await message.innerText()) ?? '')![0];
  await expect(id(office, `pilot-app-${salon}`)).toContainText('Approved');

  // The owner signs up with the code ("Have a pilot code?") and sets up the salon.
  const email = `pilot-${uid()}@e2e.test`;
  await page.goto('/sign-up');
  await field(page, 'name').fill('Mariam');
  await field(page, 'email').fill(email);
  await field(page, 'password').fill('Owner1234!');
  await id(page, 'sign-up-pilot').click();
  await field(page, 'pilotCode').fill(code.toLowerCase());
  await id(page, 'sign-up-submit').click();
  await expect(id(page, 'setup-next')).toBeVisible({ timeout: 30_000 });
  await field(page, 'businessName').fill(salon);
  await id(page, 'setup-next').click();
  await id(page, 'setup-next').click(); // country: UAE
  await id(page, 'setup-next').click(); // the salon type
  await field(page, 'branchName').fill('Al Wasl');
  await id(page, 'setup-next').click();
  await id(page, 'setup-next').click(); // create
  await expect(id(page, 'tab-index')).toBeVisible({ timeout: 30_000 });
  await page.goto('/plan');
  await expect(id(page, 'plan-status-line')).toContainText('Pilot salon · free until');
  const { data: biz } = await admin.from('businesses').select('id').eq('name', salon).single();
  const { data: sub } = await admin.from('subscriptions').select('access_type, pilot_code').eq('business_id', biz!.id).single();
  expect(sub).toMatchObject({ access_type: 'pilot', pilot_code: code });
});

test('an owner adds a branch (its price first, nothing charged), opens it, and the bill counts each branch', async ({ page, mode }) => {
  const owner = await createOwner(mode);
  await ownerOn(page, mode, owner.email, owner.password);
  await tab(page, 'more');
  await id(page, 'more-branches').click();
  await id(page, 'branch-add').click();
  await id(page, 'branch-new-name').fill('Marina');
  await id(page, 'branch-new-address').fill('Dubai Marina');
  await expect(id(page, 'branch-new-price')).toContainText('This branch adds AED 50.00 a month');
  await expect(id(page, 'branch-new-price')).toContainText('Nothing is charged now');
  await id(page, 'branch-new-save').click();
  await expect(text(page, 'Added Marina')).toBeVisible();
  await expect(id(page, 'branch-Marina')).toBeVisible();

  // The plan's bill: one line per branch; the owner counts once, at the first branch.
  await page.goto('/plan');
  await expect(id(page, 'plan-branch-Marina')).toContainText('0 people sign in here');
  await expect(id(page, 'plan-price')).toHaveText('AED 100.00');

  // Opening the new branch: the whole app follows (Home names it).
  await tab(page, 'more');
  await id(page, 'more-branches').click();
  await id(page, 'branch-open-Marina').click();
  await expect(id(page, 'tab-index')).toBeVisible();
  await expect(text(page, /Marina ·/)).toBeVisible();
  const { data: member } = await admin.from('members').select('default_branch_id').eq('business_id', owner.businessId).eq('role', 'owner').single();
  const { data: marina } = await admin.from('branches').select('id').eq('business_id', owner.businessId).eq('name', 'Marina').single();
  expect(member!.default_branch_id).toBe(marina!.id);
});
