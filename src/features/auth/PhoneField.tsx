/**
 * A mobile / WhatsApp number with its country code (website brief 3.3): the code is a button that opens a searchable
 * list of countries, set to where the visitor is (by IP, else the device's time zone); the number beside it. Optional.
 */
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { guessCountry } from '@/features/setup/CountryStep';
import { COUNTRIES, countryName, countryOf } from '@/lib/countries';
import { visitorCountry } from '@/lib/geo';
import { spacing, useTheme } from '@/theme';
import { BottomSheet, Icon, SearchBar, Text, TextField } from '@/ui';

export interface PhoneValue {
  /** Digits of the country code, e.g. "971". */
  dial: string;
  number: string;
}

/** "+971501234567", or '' without a number (a leading 0 of the local number dropped). */
export function composePhone(v: PhoneValue): string {
  const digits = v.number.replace(/\D/g, '').replace(/^0+/, '');
  return digits ? `+${v.dial}${digits}` : '';
}

/** A number is 6–14 digits, or nothing. */
export function phoneNumberValid(number: string): boolean {
  const digits = number.replace(/\D/g, '');
  return digits.length === 0 || (digits.length >= 6 && digits.length <= 14 && /^[0-9 ()-]+$/.test(number.trim()));
}

/** The visitor's country code: by IP, else the device's time zone. */
export function useDefaultDial(): string | null {
  const where = useQuery({ queryKey: ['visitor-country'], queryFn: () => visitorCountry(), staleTime: Infinity });
  if (where.isPending) return null;
  return ((where.data && countryOf(where.data)?.dial) || guessCountry().dial).replace(/\D/g, '');
}

export function PhoneField({
  value,
  onChange,
  label,
  hint,
  error,
  testID,
}: {
  value: PhoneValue;
  onChange: (v: PhoneValue) => void;
  label: string;
  hint?: string;
  error?: string;
  testID?: string;
}) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dial = useDefaultDial();
  // Until the visitor picks one, the code follows where they are.
  const [picked, setPicked] = useState(false);
  useEffect(() => {
    if (!picked && dial && dial !== value.dial) onChange({ ...value, dial });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the visitor's country is found
  }, [dial]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return COUNTRIES.map((c) => ({ code: c.code, dial: c.dial, name: countryName(c.code, i18n.language) }))
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.dial.includes(q.replace(/^\+/, '')))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [search, i18n.language]);

  return (
    <>
      <TextField
        label={label}
        hint={hint}
        error={error}
        value={value.number}
        onChangeText={(number) => onChange({ ...value, number })}
        keyboardType="phone-pad"
        autoComplete="tel-national"
        maxLength={18}
        testID={testID}
        start={
          <Pressable
            onPress={() => setOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t('auth.phone.code', { code: `+${value.dial}` })}
            style={[styles.code, { borderColor: theme.colors.divider }]}
            testID={testID ? `${testID}-code` : undefined}
          >
            <Text weight="semibold" style={styles.ltr}>{`+${value.dial}`}</Text>
            <Icon name="chevronDown" size={14} color={theme.colors.textSecondary} />
          </Pressable>
        }
      />
      <BottomSheet open={open} onClose={() => setOpen(false)} title={t('auth.phone.pick')}>
        <View style={styles.sheet}>
          <SearchBar value={search} onChangeText={setSearch} placeholder={t('auth.phone.search')} testID="phone-code-search" />
          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {list.map((c) => (
              <Pressable
                key={c.code}
                onPress={() => {
                  setPicked(true);
                  onChange({ ...value, dial: c.dial.replace(/\D/g, '') });
                  setOpen(false);
                  setSearch('');
                }}
                accessibilityRole="button"
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.colors.primary50 }]}
                testID={`phone-code-${c.code}`}
              >
                <Text style={styles.flex}>{c.name}</Text>
                <Text color="textSecondary" style={styles.ltr}>
                  {c.dial}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  code: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingEnd: spacing.sm, marginEnd: spacing.xs, borderEndWidth: 1, minHeight: 32 },
  // Numbers read left to right in Arabic and Urdu too.
  ltr: { writingDirection: 'ltr' },
  sheet: { gap: spacing.md },
  list: { maxHeight: 420 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48, paddingHorizontal: spacing.sm },
  flex: { flex: 1 },
});
