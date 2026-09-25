import { parentPath } from './navigation';

describe('parentPath', () => {
  it.each([
    ['/sales/0f3c', '/sales'],
    ['/sales', '/more'],
    ['/services/form', '/services'],
    ['/services/categories', '/services'],
    ['/services', '/more'],
    ['/customers/9a1b', '/customers'],
    ['/customers/form', '/customers'],
    ['/settings/team', '/more'],
    ['/settings/branch', '/more'],
    ['/appointment/new', '/queue'],
    ['/queue', '/'],
    ['/customers/form?id=9a1b', '/customers'],
  ])('%s → %s', (from, to) => {
    expect(parentPath(from)).toBe(to);
  });
});
