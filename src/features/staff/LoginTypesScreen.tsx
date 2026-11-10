import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { Role } from '@/lib/permissions';
import { semantic, spacing, useTheme } from '@/theme';
import { Card, HeaderBand, Screen, SectionHeader, SegmentTabs, Text } from '@/ui';

import { LOGIN_TABLE, LOGIN_TYPES, markOf, type Mark } from './loginTable';

const MARK_COLOUR: Partial<Record<Mark, string>> = { yes: semantic.success.pressed, pin: semantic.warning.pressed };

/**
 * "What each login can do" (More → Staff, brief B2): pick a login type, read what it can do, area by area. Opened
 * from the staff form's "See everything this login can do" with that login type chosen.
 */
export function LoginTypesScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const params = useLocalSearchParams<{ role?: string }>();
  const [role, setRole] = useState<Role>(LOGIN_TYPES.includes(params.role as Role) ? (params.role as Role) : 'manager');
  const column = LOGIN_TYPES.indexOf(role);

  return (
    <Screen
      header={
        <HeaderBand title={t('logins.title')} subtitle={t('logins.subtitle')} onBack>
          <SegmentTabs<Role>
            items={LOGIN_TYPES.map((r) => ({ key: r, label: t(`roles.${r}`) }))}
            value={role}
            onChange={setRole}
            testID="logins-type"
          />
        </HeaderBand>
      }
    >
      <View style={styles.body}>
        <Card variant="tinted" style={styles.card}>
          <Text variant="bodyStrong">{t(`roles.${role}`)}</Text>
          <Text color="textSecondary" testID="logins-description">
            {role === 'owner' ? t('logins.ownerHint') : t(`team.roleHint.${role}`)}
          </Text>
        </Card>
        {LOGIN_TABLE.map(({ area, rows }) => (
          <View key={area} style={styles.block}>
            <SectionHeader title={t(`logins.area.${area}` as 'logins.area.sales')} />
            <Card variant="outlined" style={styles.list}>
              {rows.map((row, i) => {
                const cell = row.cells[column]!;
                const mark = markOf(cell);
                return (
                  <View
                    key={row.key}
                    style={[styles.row, i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider } : null]}
                    testID={`logins-row-${row.key}`}
                  >
                    <Text style={styles.label}>{t(`logins.row.${row.key}` as 'logins.row.checkout')}</Text>
                    <Text
                      variant="bodyStrong"
                      style={[styles.value, mark && MARK_COLOUR[mark] ? { color: MARK_COLOUR[mark] } : null]}
                      color={mark === 'no' ? 'textSecondary' : undefined}
                    >
                      {mark ? t(`logins.mark.${mark}`) : t(`logins.cell.${cell.slice(5)}` as 'logins.cell.any')}
                    </Text>
                  </View>
                );
              })}
            </Card>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  card: { gap: spacing.xs },
  block: { gap: spacing.sm },
  list: { paddingVertical: 0 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingVertical: spacing.md },
  label: { flexGrow: 1, flexShrink: 1, flexBasis: 180 },
  value: { flexShrink: 1, textAlign: 'right', maxWidth: '100%' },
});
