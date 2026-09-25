/** Sign-up races at the database, through the same API calls the setup wizard makes. */
import { admin, userClient } from './support/api';
import { uid } from './support/env';
import { expect, test } from './support/fixtures';

async function newUser() {
  const email = `race-${uid()}@e2e.test`;
  const { error } = await admin.auth.admin.createUser({ email, password: 'Race1234!', email_confirm: true });
  if (error) throw error;
  return userClient(email, 'Race1234!');
}

const setup = (name: string, mode: string) => ({ p: { business_name: name, owner_name: 'Race', mode, vat_mode: 'off' } });

test('one owner sending setup twice at once gets exactly one salon', async ({ mode }) => {
  const owner = await newUser();
  const results = await Promise.all([owner.rpc('create_business', setup(`Twice ${uid()}`, mode)), owner.rpc('create_business', setup(`Twice ${uid()}`, mode))]);
  expect(results.filter((r) => !r.error)).toHaveLength(1);
  expect(results.find((r) => r.error)?.error?.message).toMatch(/already_has_business/);
  const { data: user } = await owner.auth.getUser();
  const { count } = await admin.from('members').select('id', { count: 'exact', head: true }).eq('user_id', user.user!.id);
  expect(count).toBe(1);
});

test('twelve salons with the same name signing up together all get their own code', async ({ mode }) => {
  const owners = await Promise.all(Array.from({ length: 12 }, newUser));
  const results = await Promise.all(owners.map((o) => o.rpc('create_business', setup('Same Name Salon', mode))));
  for (const r of results) expect(r.error).toBeNull();
  const codes = results.map((r) => (r.data as { code: string }).code);
  expect(new Set(codes).size).toBe(12);
  for (const code of codes) expect(code).toMatch(/^[a-z0-9]{4,12}$/);
});
