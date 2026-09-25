/**
 * A membership load that finishes late must never undo a sign-out or leak into the next person's
 * session on a shared phone.
 */
import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { SessionProvider, useSession } from './session';

type Listener = (event: string, session: unknown) => void;
type Deferred = { promise: Promise<unknown>; resolve: (v: unknown) => void };

const mockDeferred = (): Deferred => {
  let resolve!: (v: unknown) => void;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};

const mock = {
  listener: null as Listener | null,
  /** One pending members lookup per user id, resolved by the test. */
  members: new Map<string, Deferred>(),
};

const member = (user: string) => ({
  id: `m-${user}`,
  user_id: user,
  business_id: `b-${user}`,
  role: 'owner',
  active: true,
  display_name: user,
  default_branch_id: `br-${user}`,
});

/** A query-builder stand-in: every method chains; awaiting it answers by table and filter. */
function mockBuilder(table: string) {
  const filters: Record<string, string> = {};
  const chain: Record<string, unknown> = {};
  for (const name of ['select', 'order', 'limit', 'single', 'maybeSingle']) chain[name] = () => chain;
  chain.eq = (column: string, value: string) => {
    filters[column] = value;
    return chain;
  };
  chain.then = (onFulfilled: (v: unknown) => unknown, onRejected: (e: unknown) => unknown) => {
    const answer = (): Promise<unknown> => {
      if (table === 'members') {
        const user = filters.user_id!;
        if (!mock.members.has(user)) mock.members.set(user, mockDeferred());
        return mock.members.get(user)!.promise.then((data) => ({ data, error: null }));
      }
      const owner = (filters.id ?? filters.business_id ?? filters.member_id ?? '').replace(/^(b|m)-/, '');
      if (table === 'businesses') return Promise.resolve({ data: { id: `b-${owner}`, timezone: 'Asia/Dubai' }, error: null });
      if (table === 'branches')
        return Promise.resolve({ data: [{ id: `br-${owner}`, mode: 'gents', settings: {} }], error: null });
      return Promise.resolve({ data: null, error: null });
    };
    return answer().then(onFulfilled, onRejected);
  };
  return chain;
}

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: (cb: Listener) => {
        mock.listener = cb;
        return { data: { subscription: { unsubscribe: () => undefined } } };
      },
      signOut: () => Promise.resolve({ error: null }),
    },
    from: (table: string) => mockBuilder(table),
    rpc: () => Promise.resolve({ data: null, error: null }),
    channel: () => {
      const channel = { on: () => channel, subscribe: () => channel };
      return channel;
    },
    removeChannel: () => Promise.resolve(),
  },
}));

function Probe() {
  const s = useSession();
  return <Text testID="probe">{`${s.status}|${s.member?.user_id ?? '-'}|${s.business?.id ?? '-'}`}</Text>;
}

const session = (user: string) => ({ user: { id: user }, access_token: 't' });
const probe = () => screen.getByTestId('probe').props.children as string;
const flush = () => act(async () => {});

async function start() {
  await render(
    <SessionProvider>
      <Probe />
    </SessionProvider>,
  );
  await flush();
  expect(probe()).toBe('signedOut|-|-');
}

beforeEach(() => {
  mock.listener = null;
  mock.members.clear();
});

it('a load that finishes after sign-out does not sign the device back in', async () => {
  await start();
  await act(async () => mock.listener!('SIGNED_IN', session('ali')));
  expect(probe()).toBe('loading|-|-');

  await act(async () => mock.listener!('SIGNED_OUT', null));
  expect(probe()).toBe('signedOut|-|-');

  // Ali's slow membership answer arrives now.
  await act(async () => mock.members.get('ali')!.resolve(member('ali')));
  await flush();
  expect(probe()).toBe('signedOut|-|-');
});

it("on a shared phone, the previous person's late answer never replaces the new person's salon", async () => {
  await start();
  await act(async () => mock.listener!('SIGNED_IN', session('ali')));
  await act(async () => mock.listener!('SIGNED_OUT', null));
  await act(async () => mock.listener!('SIGNED_IN', session('noor')));

  await act(async () => mock.members.get('noor')!.resolve(member('noor')));
  await flush();
  expect(probe()).toBe('ready|noor|b-noor');

  await act(async () => mock.members.get('ali')!.resolve(member('ali')));
  await flush();
  expect(probe()).toBe('ready|noor|b-noor');
});

it('a normal sign-in still loads the salon', async () => {
  await start();
  await act(async () => mock.listener!('SIGNED_IN', session('sara')));
  await act(async () => mock.members.get('sara')!.resolve(member('sara')));
  await flush();
  expect(probe()).toBe('ready|sara|b-sara');
});
