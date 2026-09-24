import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { spacing, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  /** What is being counted, for screen readers ("Haircut"). */
  itemLabel: string;
  min?: number;
  max?: number;
  /** At zero, show an "Add" button instead of "– 0 +". */
  showAddAtZero?: boolean;
  /** Stretch to the parent's width (grid tiles). */
  fullWidth?: boolean;
}

/**
 * Gents: tinted pill ("Book now" style). Ladies: outlined coral "Add" that becomes "– 1 +".
 */
export function Stepper({
  value,
  onChange,
  itemLabel,
  min = 0,
  max = 99,
  showAddAtZero = true,
  fullWidth,
}: StepperProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const tinted = theme.variants.listAction === 'tinted';
  const shape = {
    borderRadius: tinted ? theme.radius.pill : theme.radius.sm,
    backgroundColor: tinted ? theme.colors.primary50 : theme.colors.surface,
    borderWidth: tinted ? 0 : 1,
    borderColor: theme.colors.primary500,
  };
  const ink = theme.colors.primaryText;

  if (value <= min && showAddAtZero) {
    return (
      <Pressable
        onPress={() => onChange(Math.min(max, value + 1))}
        accessibilityRole="button"
        accessibilityLabel={t('common.addItem', { item: itemLabel })}
        hitSlop={6}
        style={({ pressed }) => [
          styles.box,
          styles.add,
          shape,
          fullWidth && styles.full,
          pressed && styles.pressed,
        ]}
      >
        <Text variant="small" weight="semibold" style={{ color: ink }}>
          {t('common.add')}
        </Text>
      </Pressable>
    );
  }

  const step = (icon: IconName, delta: number, label: string, disabled: boolean) => (
    <Pressable
      onPress={() => onChange(value + delta)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [styles.step, (pressed || disabled) && styles.pressed]}
    >
      <Icon
        name={icon}
        size={16}
        strokeWidth={2}
        color={disabled ? theme.colors.textDisabled : ink}
      />
    </Pressable>
  );

  return (
    <View
      style={[styles.box, shape, fullWidth && styles.full, fullWidth && styles.spread]}
      accessibilityRole="adjustable"
      accessibilityLabel={itemLabel}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) =>
        onChange(
          e.nativeEvent.actionName === 'increment'
            ? Math.min(max, value + 1)
            : Math.max(min, value - 1),
        )
      }
    >
      {step('minus', -1, t('common.decrease', { item: itemLabel }), value <= min)}
      <Text
        variant="bodyStrong"
        weight="semibold"
        tabular
        align="center"
        style={[styles.count, { color: ink }]}
      >
        {String(value)}
      </Text>
      {step('plus', 1, t('common.increase', { item: itemLabel }), value >= max)}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { height: 32, flexDirection: 'row', alignItems: 'center' },
  add: { minWidth: 72, justifyContent: 'center', paddingHorizontal: spacing.lg },
  step: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  count: { minWidth: 20 },
  full: { alignSelf: 'stretch', height: 36 },
  spread: { justifyContent: 'space-between' },
  pressed: { opacity: 0.5 },
});
