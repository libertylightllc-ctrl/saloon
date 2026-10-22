/** "Already use a booking app? Keep it." (website brief 2.7): Saloqo runs what a booking app does not. No names. */
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { brandPalette as B, spacing } from '@/theme';
import { Icon, Text } from '@/ui';

import { Band, useLandingLayout } from './parts';

export function KeepYourApp() {
  const { t } = useTranslation();
  const { compact } = useLandingLayout();
  return (
    <Band ground={B.lilacMist} style={[styles.band, compact && styles.bandCompact]} testID="landing-keep">
      <View style={styles.row}>
        <View style={styles.icon}>
          <Icon name="repeat" size={22} color={B.violet} />
        </View>
        <View style={styles.flex}>
          <Text variant="h4" style={styles.ink}>
            {t('auth.landing.keep.title')}
          </Text>
          <Text style={styles.muted}>{t('auth.landing.keep.body')}</Text>
        </View>
      </View>
    </Band>
  );
}

const styles = StyleSheet.create({
  band: { paddingVertical: spacing['2xl'] },
  bandCompact: { paddingVertical: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, maxWidth: 900, alignSelf: 'center', width: '100%' },
  icon: { width: 48, height: 48, borderRadius: 24, backgroundColor: B.card, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  flex: { flex: 1, gap: 2 },
  ink: { color: B.ink },
  muted: { color: B.inkMuted },
});
