import { formatInTimeZone } from 'date-fns-tz';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { brand } from '@/config/brand';
import { useWorkspace } from '@/features/auth/session';
import { businessDate, formatDayLabel } from '@/lib/dates';
import { spacing, useTheme } from '@/theme';
import { Avatar, Text } from '@/ui';

export function partOfDay(timeZone: string, at = new Date()): 'morning' | 'afternoon' | 'evening' {
  const hour = Number(formatInTimeZone(at, timeZone, 'H'));
  return hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
}

/** Gents: avatar + greeting inside the violet band. Ladies: coral wordmark row on blush. */
export function HomeTop({ subline }: { subline: string }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { member, business, branch } = useWorkspace();
  const greeting = t(`home.greeting.${partOfDay(business.timezone)}`, { name: member.display_name });
  const place = `${branch.name} · ${formatDayLabel(businessDate(new Date(), business.timezone), i18n.language)}`;

  if (theme.variants.homeTop === 'profile') {
    return (
      <View style={styles.profile}>
        <Avatar name={member.display_name} size={48} ring />
        <View style={styles.flex}>
          <Text variant="h4" color="onPrimary" numberOfLines={1} testID="home-greeting">
            {greeting}
          </Text>
          <Text variant="small" color="onPrimary" numberOfLines={1}>
            {place}
          </Text>
          <Text variant="small" color="onPrimary" numberOfLines={1}>
            {subline}
          </Text>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.wordmarkBlock}>
      <View style={styles.wordmark}>
        <Text variant="h3" weight="bold" style={[styles.flex, { color: theme.colors.primary500 }]} numberOfLines={1}>
          {brand.appName.toLocaleUpperCase()}
        </Text>
        <Avatar name={member.display_name} size={36} />
      </View>
      <Text variant="h3" testID="home-greeting">
        {greeting}
      </Text>
      <Text variant="small" color="textOnTint">
        {place}
      </Text>
      <Text variant="small" color="textOnTint">
        {subline}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingTop: spacing.md },
  wordmarkBlock: { gap: 2, paddingTop: spacing.md },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
});
