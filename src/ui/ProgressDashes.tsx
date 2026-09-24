import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

export interface ProgressDashesProps {
  total: number;
  /** step: index of the current step · progress: number of steps done */
  current: number;
  mode?: 'step' | 'progress';
  onBand?: boolean;
}

/** Onboarding dashes (active one long and coloured) or setup progress. */
export function ProgressDashes({ total, current, mode = 'step', onBand }: ProgressDashesProps) {
  const { colors } = useTheme();
  const on = onBand ? colors.onPrimary : colors.primary500;
  const off = onBand ? colors.primary400 : colors.primary200;

  return (
    <View
      style={styles.row}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: mode === 'step' ? current + 1 : current }}
    >
      {Array.from({ length: total }, (_, i) => {
        const active = mode === 'step' ? i === current : i < current;
        return (
          <View
            key={i}
            style={[
              styles.dash,
              mode === 'step' ? { width: active ? 32 : 16 } : styles.even,
              { backgroundColor: active ? on : off },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dash: { height: 4, borderRadius: 2 },
  even: { flex: 1, maxWidth: 28 },
});
