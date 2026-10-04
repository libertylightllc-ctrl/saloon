import type { NavItem } from './navItems';
import { activeKey } from './navItems';

const items: NavItem[] = [
  { key: 'index', icon: 'home', href: '/', label: 'Home' },
  { key: 'queue', icon: 'users', href: '/queue', label: 'Queue' },
  { key: 'sales', icon: 'receipt', href: '/sales', label: 'Sales' },
  { key: 'sale', icon: 'receipt', href: '/sale', label: 'Quick sale' },
  { key: 'branch', icon: 'store', href: '/settings/branch', label: 'Branch' },
];

describe('activeKey', () => {
  it('lights the page on screen, including its sub-pages', () => {
    expect(activeKey('/', items)).toBe('index');
    expect(activeKey('/queue', items)).toBe('queue');
    expect(activeKey('/sales/42', items)).toBe('sales');
    expect(activeKey('/sale', items)).toBe('sale');
    expect(activeKey('/settings/branch', items)).toBe('branch');
  });

  it('lights nothing for a page that is not in the list', () => {
    expect(activeKey('/settings/backup', items)).toBeNull();
    expect(activeKey('/salesman', items)).toBeNull();
  });
});
