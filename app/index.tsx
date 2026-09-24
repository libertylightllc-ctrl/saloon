/**
 * Phase 0 placeholder: proves fonts, i18n, RTL, money and dates work on a phone.
 * Replaced by the auth / tabs entry in phases 1–2. Colours arrive with the theme in phase 1.
 */
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { brand } from '@/config/brand';
import { businessDate, formatDayLabel } from '@/lib/dates';
import { fontFamily, type FontWeightName } from '@/lib/fonts';
import { isLanguage, isRtlLanguage, LANGUAGES, DEFAULT_LANGUAGE, type Language } from '@/lib/i18n';
import { changeLanguage } from '@/lib/language';
import { formatMoney } from '@/lib/money';

export default function PlaceholderScreen() {
  const { t, i18n } = useTranslation();
  const language: Language = isLanguage(i18n.language) ? i18n.language : DEFAULT_LANGUAGE;
  const font = (weight: FontWeightName, lang: Language = language) => ({
    fontFamily: fontFamily(lang, weight),
  });
  const direction = t(isRtlLanguage(language) ? 'language.rtl' : 'language.ltr');

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, font('bold')]}>{brand.appName}</Text>
        <Text style={[styles.heading, font('semibold')]}>{t('placeholder.heading')}</Text>
        <Text style={[styles.body, font('regular')]}>{t('placeholder.body')}</Text>

        <Text style={[styles.section, font('semibold')]}>{t('placeholder.directionTitle')}</Text>
        <View style={styles.row}>
          <Text style={[styles.box, font('medium')]}>{t('placeholder.start')}</Text>
          <Text style={[styles.box, font('medium')]}>{t('placeholder.end')}</Text>
        </View>
        <Text style={[styles.body, font('regular')]}>
          {t('placeholder.directionNow', { direction })}
        </Text>
        <Text style={[styles.body, font('regular')]}>
          {t('placeholder.sampleDate', { date: formatDayLabel(businessDate()) })}
        </Text>
        <Text style={[styles.body, styles.tabular, font('regular')]}>
          {t('placeholder.sampleAmount', { amount: formatMoney(124000) })}
        </Text>

        <Text style={[styles.section, font('semibold')]}>{t('language.title')}</Text>
        <View accessibilityRole="radiogroup">
          {LANGUAGES.map((option) => {
            const selected = option.code === language;
            return (
              <Pressable
                key={option.code}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => void changeLanguage(option.code)}
                style={({ pressed }) => [styles.option, pressed && styles.pressed]}
              >
                <Text
                  style={[styles.optionLabel, font(selected ? 'bold' : 'regular', option.code)]}
                >
                  {option.nativeName}
                </Text>
                {selected ? <Text style={styles.optionLabel}>✓</Text> : null}
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.note, font('regular')]}>{t('language.restartNote')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 20, paddingVertical: 24, gap: 8 },
  title: { fontSize: 28, lineHeight: 36 },
  heading: { fontSize: 20, lineHeight: 28 },
  body: { fontSize: 14, lineHeight: 20 },
  tabular: { fontVariant: ['tabular-nums'] },
  section: { fontSize: 16, lineHeight: 24, marginTop: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  box: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  option: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pressed: { opacity: 0.6 },
  optionLabel: { fontSize: 16, lineHeight: 24 },
  note: { fontSize: 12, lineHeight: 16, marginTop: 8 },
});
