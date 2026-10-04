import { usePathname, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useWorkspace } from '@/features/auth/session';
import { brand } from '@/config/brand';
import { spacing, useTheme } from '@/theme';
import { Avatar, Icon, NAV_WIDTH, Text, useLayoutSize } from '@/ui';

import { activeKey, useNavSections, type NavItem } from './navItems';

/**
 * The side navigation on wider screens (owner's choice 2026-10-04): on a computer a sidebar with every page in
 * sections (Option A), on a tablet an icon rail with the counter's pages (Option B). Phones keep the tab bar.
 */
export function SideNav() {
  const size = useLayoutSize();
  if (size === 'phone') return null;
  return size === 'desktop' ? <Sidebar /> : <Rail />;
}

function useGo() {
  const router = useRouter();
  return (href: Href) => router.navigate(href);
}

function Sidebar() {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const go = useGo();
  const { member, branch, role } = useWorkspace();
  const sections = useNavSections();
  const active = activeKey(pathname, sections.flatMap((s) => s.items));
  const { colors } = theme;

  return (
    <View
      role="navigation"
      aria-label={t('nav.label')}
      style={[styles.sidebar, { backgroundColor: colors.surface, borderEndColor: colors.divider, paddingTop: insets.top }]}
    >
      <ScrollView contentContainerStyle={[styles.sidebarBody, { paddingBottom: spacing.lg + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={styles.brand}>
          <View style={[styles.logo, { backgroundColor: colors.primaryAction }]}>
            <Icon name="scissors" size={20} color={colors.onPrimary} />
          </View>
          <Text variant="h2">{brand.appName}</Text>
        </View>
        <View style={[styles.branch, { borderColor: colors.border, borderRadius: theme.radius.md }]}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {branch.name}
          </Text>
          <Text variant="small" color="textSecondary" numberOfLines={1}>
            {t(`auth.salonType.${branch.mode}`)}
          </Text>
        </View>
        {sections.map((section) => (
          <View key={section.key} style={styles.section}>
            <Text variant="small" color="textSecondary" style={styles.sectionTitle}>
              {section.title}
            </Text>
            {section.items.map((item) => (
              <SidebarItem key={item.key} item={item} active={item.key === active} onPress={() => go(item.href)} />
            ))}
          </View>
        ))}
        <View style={styles.flex} />
        <Pressable
          onPress={() => go('/more')}
          accessibilityRole="link"
          accessibilityLabel={t('nav.account')}
          testID="nav-more"
          style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
            styles.me,
            {
              backgroundColor: pathname === '/more' || pressed || hovered ? colors.primary50 : colors.background,
              borderRadius: theme.radius.md,
              },
          ]}
        >
          <Avatar name={member.display_name} size={36} />
          <View style={styles.flex}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {member.display_name}
            </Text>
            <Text variant="small" color="textSecondary" numberOfLines={1}>
              {t(`roles.${role}`)}
            </Text>
          </View>
          <Icon name="grid" size={18} color={colors.textSecondary} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

function SidebarItem({ item, active, onPress }: { item: NavItem; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  const { colors } = theme;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      aria-current={active ? 'page' : undefined}
      accessibilityLabel={item.label}
      testID={`nav-${item.key}`}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.item,
        { borderRadius: theme.radius.sm + 2 },
        (active || pressed || hovered) && { backgroundColor: active ? colors.primary50 : colors.background },
      ]}
    >
      <Icon name={item.icon} size={20} color={active ? colors.primaryText : colors.textSecondary} strokeWidth={active ? 2 : 1.75} />
      <Text weight={active ? 'semibold' : 'regular'} color={active ? 'primaryText' : 'text'} numberOfLines={1} style={styles.flex}>
        {item.label}
      </Text>
    </Pressable>
  );
}

/** The paths the side navigation opens directly on this screen size (their headers drop the back arrow). */
export function useNavRoots(): ReadonlySet<string> | null {
  const size = useLayoutSize();
  const sections = useNavSections();
  const all = sections.flatMap((s) => s.items);
  if (size === 'phone') return null;
  const items = size === 'desktop' ? all : railItems(sections, all);
  return new Set([...items.map((i) => (typeof i.href === 'string' ? i.href : String(i.href.pathname))), '/more']);
}

function railItems(sections: ReturnType<typeof useNavSections>, all: NavItem[]): NavItem[] {
  return [
    ...(sections.find((s) => s.key === 'today')?.items ?? []),
    ...all.filter((i) => i.key === 'cashClosing' || i.key === 'reports'),
  ];
}

/** Tablet rail: the day's pages, cash closing and reports when allowed, then everything else under More. */
function Rail() {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const go = useGo();
  const sections = useNavSections();
  const all = sections.flatMap((s) => s.items);
  const counter = railItems(sections, all).map((i) => (i.key === 'cashClosing' ? { ...i, label: t('nav.short.cashClosing') } : i));
  const items: NavItem[] = [...counter, { key: 'more', icon: 'grid', href: '/more', label: t('tabs.more') }];
  // A page that is not on the rail lights More, where it lives.
  const active = activeKey(pathname, items) ?? (activeKey(pathname, all) ? 'more' : null);
  const { colors } = theme;

  return (
    <View
      role="navigation"
      aria-label={t('nav.label')}
      style={[styles.rail, { backgroundColor: colors.surface, borderEndColor: colors.divider, paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}
    >
      <View style={[styles.logo, styles.railLogo, { backgroundColor: colors.primaryAction }]}>
        <Icon name="scissors" size={20} color={colors.onPrimary} />
      </View>
      <ScrollView contentContainerStyle={styles.railItems} showsVerticalScrollIndicator={false}>
        {items.map((item) => {
          const on = item.key === active;
          return (
            <Pressable
              key={item.key}
              onPress={() => go(item.href)}
              accessibilityRole="link"
              aria-current={on ? 'page' : undefined}
              accessibilityLabel={item.label}
              testID={`nav-${item.key}`}
              style={[styles.railItem, { borderRadius: theme.radius.md }, on && { backgroundColor: colors.primary100 }]}
            >
              <Icon name={item.icon} size={22} color={on ? colors.primaryText : colors.textSecondary} strokeWidth={on ? 2 : 1.75} />
              <Text variant="micro" weight={on ? 'semibold' : 'medium'} color={on ? 'primaryText' : 'textSecondary'} numberOfLines={1} align="center">
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sidebar: { width: NAV_WIDTH.desktop, borderEndWidth: StyleSheet.hairlineWidth },
  sidebarBody: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xl, gap: spacing.lg },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.sm },
  logo: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  branch: { borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 2 },
  section: { gap: 2 },
  sectionTitle: { paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, minHeight: 40 },
  me: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  rail: { width: NAV_WIDTH.tablet, alignItems: 'center', gap: spacing.lg, borderEndWidth: StyleSheet.hairlineWidth },
  railLogo: { width: 40, height: 40, borderRadius: 12 },
  railItems: { alignItems: 'center', gap: spacing.xs },
  railItem: { width: 68, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 2 },
});
