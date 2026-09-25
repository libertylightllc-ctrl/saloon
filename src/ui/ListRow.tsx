import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { spacing, useTheme, type Tone } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface ListMeta {
  text: string;
  icon?: IconName;
  /** Colour the icon (e.g. green map pin like the Barber kit). */
  iconColor?: string;
  tone?: Extract<Tone, 'primary'>;
}

export interface ListRowProps {
  title: string;
  leading?: ReactNode;
  /** Small lines under the title. */
  meta?: (string | ListMeta)[];
  /** Badges row under the meta lines. */
  badges?: ReactNode;
  /** Price, status pill, action button… at the end. */
  trailing?: ReactNode;
  /** A row of actions under the content. */
  footer?: ReactNode;
  chevron?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
}

/** Gents: bordered card rows (Nearby Salons). Ladies: plain rows on the white sheet (Services). */
export function ListRow({
  title,
  leading,
  meta = [],
  badges,
  trailing,
  footer,
  chevron,
  onPress,
  accessibilityLabel,
  testID,
}: ListRowProps) {
  const theme = useTheme();
  const card = theme.variants.listRow === 'card';

  const content = (
    <>
      <View style={styles.main}>
        {leading}
        <View style={styles.body}>
          <Text variant="h4" numberOfLines={1}>
            {title}
          </Text>
          {meta.map((line, i) => {
            const item = typeof line === 'string' ? { text: line } : line;
            return (
              <View key={i} style={styles.metaRow}>
                {item.icon ? (
                  <Icon
                    name={item.icon}
                    size={14}
                    color={item.iconColor ?? theme.colors.textSecondary}
                  />
                ) : null}
                <Text
                  variant="small"
                  color={item.tone === 'primary' ? 'primaryText' : 'textSecondary'}
                  numberOfLines={2}
                  style={styles.flex}
                >
                  {item.text}
                </Text>
              </View>
            );
          })}
          {badges ? <View style={styles.badges}>{badges}</View> : null}
        </View>
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
        {chevron ? <Icon name="chevronRight" size={20} color={theme.colors.textSecondary} /> : null}
      </View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </>
  );

  const look = [
    styles.row,
    card
      ? {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: theme.colors.divider,
          padding: spacing.md,
        }
      : {
          paddingVertical: spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.border,
        },
  ];

  if (!onPress)
    return (
      <View style={look} testID={testID}>
        {content}
      </View>
    );
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => [look, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.md },
  main: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  body: { flex: 1, gap: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  trailing: { alignItems: 'flex-end', gap: spacing.sm },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flexShrink: 1 },
  pressed: { opacity: 0.85 },
});
