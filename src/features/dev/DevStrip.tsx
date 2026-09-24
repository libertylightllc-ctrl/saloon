/**
 * Developer strip above the demo and gallery: flip gents ↔ ladies and LTR ↔ RTL, jump between
 * the demo and the gallery. Dev builds only.
 */
import { usePathname, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing, useDirection, useDirectionOverride, useTheme, useThemeMode } from '@/theme';
import { Text } from '@/ui';

function Toggle<K extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.toggle, { borderColor: colors.neutral.n80 }]}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.option, active && { backgroundColor: colors.surface }]}
          >
            <Text
              variant="small"
              weight="semibold"
              style={{ color: active ? colors.text : colors.onPrimary }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function DevStrip() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { mode, setMode } = useThemeMode();
  const direction = useDirection();
  const { setOverride } = useDirectionOverride();
  const inGallery = pathname.startsWith('/dev/gallery');

  return (
    <View
      style={[
        styles.strip,
        { paddingTop: insets.top + spacing.xs, backgroundColor: theme.colors.text },
      ]}
    >
      <Toggle
        options={[
          { key: 'gents', label: t('dev.gents') },
          { key: 'ladies', label: t('dev.ladies') },
        ]}
        value={mode}
        onChange={setMode}
      />
      <Toggle
        options={[
          { key: 'ltr', label: t('dev.ltr') },
          { key: 'rtl', label: t('dev.rtl') },
        ]}
        value={direction}
        onChange={(d) => setOverride(d)}
      />
      <Pressable
        onPress={() => (inGallery ? router.replace('/dev/demo') : router.push('/dev/gallery'))}
        accessibilityRole="link"
        style={styles.link}
        hitSlop={8}
      >
        <Text variant="small" weight="semibold" color="onPrimary">
          {inGallery ? t('dev.demo') : t('dev.gallery')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  toggle: { flexDirection: 'row', borderWidth: 1, borderRadius: 999, padding: 2 },
  option: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: 999 },
  link: { marginStart: 'auto', paddingHorizontal: spacing.sm, paddingVertical: 4 },
});
