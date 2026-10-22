/**
 * Always a way in (website brief 2.3, 2.4). On a phone, a bar at the bottom with the main button (and WhatsApp when
 * the owner has set a number), shown once the hero's button has scrolled away and hidden while the pricing card or the
 * last call is on screen. On a computer, a round WhatsApp button in the bottom corner (bottom-left in Arabic/Urdu).
 */
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { brandPalette as B, spacing } from '@/theme';
import { Icon } from '@/ui';

import { hasWhatsApp, whatsappUrl } from './contact';
import { BrandButton } from './parts';

function WhatsAppRound({ size, testID }: { size: number; testID: string }) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={t('auth.landing.whatsapp')}
      {...({ href: whatsappUrl(), hrefAttrs: { target: '_blank', rel: 'noopener noreferrer' } } as object)}
      style={({ pressed }) => [styles.round, { width: size, height: size, borderRadius: size / 2 }, pressed && styles.pressed]}
      testID={testID}
    >
      <Icon name="messageCircle" size={size * 0.46} color={B.onNavy} />
    </Pressable>
  );
}

export function StickyBar({ visible, label, onStart }: { visible: boolean; label: string; onStart: () => void }) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + spacing.md }]} testID="landing-sticky">
      <View style={styles.flex}>
        <BrandButton label={label} icon="chevronRight" onPress={onStart} full testID="landing-start-sticky" />
      </View>
      {hasWhatsApp ? <WhatsAppRound size={52} testID="landing-sticky-whatsapp" /> : null}
    </View>
  );
}

export function FloatingWhatsApp() {
  if (!hasWhatsApp) return null;
  return (
    <View style={styles.floating} pointerEvents="box-none">
      <WhatsAppRound size={60} testID="landing-floating-whatsapp" />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    start: 0,
    end: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: B.navy,
    borderTopWidth: 1,
    borderTopColor: B.navyLine,
  },
  flex: { flex: 1 },
  round: { alignItems: 'center', justifyContent: 'center', backgroundColor: B.whatsapp, boxShadow: B.liftShadow },
  pressed: { opacity: 0.88 },
  floating: { position: 'absolute', end: 24, bottom: 24 },
});
