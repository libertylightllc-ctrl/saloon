import { getCalendars } from 'expo-localization';
import { useMemo, useState } from 'react';
import { useWatch, type Control, type UseFormSetValue } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { COUNTRIES, countryName, countryOf, DEFAULT_COUNTRY, OTHER_COUNTRY, type Country } from '@/lib/countries';
import { CURRENCIES, isCurrency } from '@/lib/currencies';
import { formatBps, setActiveCurrency } from '@/lib/money';
import { spacing, useTheme } from '@/theme';
import { Card, Chip, FormTextField, Icon, ListRow, SearchBar, Text } from '@/ui';

/** The fields this step fills in (the tax ones become the branch's sales tax, editable on the last step). */
export interface CountryValues {
  country: string;
  currency: string;
  timezone: string;
  tax_name: string;
  tax_rate: string;
  tax_inclusive: boolean;
  tax_id_label: string;
}

/** This phone's time zone ("Asia/Dubai"); null when the platform does not say. */
export function deviceTimeZone(): string | null {
  try {
    return getCalendars()[0]?.timeZone ?? null;
  } catch {
    return null;
  }
}

/** Where the phone is (by its time zone, which travels with the person less than its language does); else the UAE. */
export function guessCountry(): Country {
  const zone = deviceTimeZone();
  return COUNTRIES.find((c) => zone && c.timezones.includes(zone)) ?? countryOf(DEFAULT_COUNTRY)!;
}

/** The form values a country brings: its currency, time zone and sales tax. */
export function countryDefaults(c: Country): CountryValues {
  const zone = deviceTimeZone();
  return {
    country: c.code,
    currency: c.currency,
    timezone: zone && c.timezones.includes(zone) ? zone : c.timezones[0]!,
    tax_name: c.tax.name,
    tax_rate: formatBps(c.tax.rateBps).replace('%', ''),
    tax_inclusive: c.tax.inclusive,
    tax_id_label: c.tax.idLabel,
  };
}

export function CountryStep<T extends CountryValues>({
  control,
  setValue,
  preview = true,
}: {
  control: Control<T>;
  setValue: UseFormSetValue<T>;
  /** Setup shows the next steps' amounts in the picked currency at once; Branch settings waits for the save. */
  preview?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const c = control as unknown as Control<CountryValues>;
  const set = setValue as unknown as UseFormSetValue<CountryValues>;
  const [code, currency, timezone] = useWatch({ control: c, name: ['country', 'currency', 'timezone'] });
  const picked = countryOf(code);
  const other = code === OTHER_COUNTRY;

  const named = useMemo(
    () => COUNTRIES.map((x) => ({ ...x, label: countryName(x.code, i18n.language) })).sort((a, b) => a.label.localeCompare(b.label)),
    [i18n.language],
  );
  const q = search.trim().toLowerCase();
  const shown = named.filter((x) => !q || x.label.toLowerCase().includes(q) || x.name.toLowerCase().includes(q) || x.currency.toLowerCase().includes(q));

  const pick = (next: Country) => {
    const v = countryDefaults(next);
    (Object.keys(v) as (keyof CountryValues)[]).forEach((k) => set(k, v[k], { shouldValidate: true }));
    if (preview) setActiveCurrency(next.currency);
  };
  const pickOther = () => {
    set('country', OTHER_COUNTRY);
    set('timezone', deviceTimeZone() ?? timezone);
    set('tax_name', 'Tax');
    set('tax_rate', '0');
    set('tax_id_label', 'Tax number');
  };
  const pickCurrency = (next: string) => {
    set('currency', next);
    if (preview && isCurrency(next)) setActiveCurrency(next);
  };

  return (
    <View style={styles.body}>
      <Card variant="outlined" style={styles.row} testID="setup-country-picked">
        <Icon name="mapPin" size={22} color={theme.colors.primary500} />
        <View style={styles.flex}>
          <Text variant="h4">{other ? t('setup.country.other') : countryName(code, i18n.language)}</Text>
          <Text variant="small" color="textSecondary">
            {picked
              ? t('setup.country.detail', {
                  currency,
                  tax: picked.tax.rateBps > 0 ? `${picked.tax.name} ${formatBps(picked.tax.rateBps)}` : t('setup.country.noTax'),
                  zone: timezone,
                })
              : t('setup.country.otherDetail')}
          </Text>
        </View>
      </Card>

      {picked && picked.timezones.length > 1 ? (
        <View style={styles.wrap}>
          {picked.timezones.map((z) => (
            <Chip key={z} label={z.split('/').pop()!.replace(/_/g, ' ')} selected={timezone === z} onPress={() => set('timezone', z)} />
          ))}
        </View>
      ) : null}

      {other ? (
        <>
          <Text variant="bodyStrong">{t('setup.country.currency')}</Text>
          <View style={styles.wrap}>
            {Object.keys(CURRENCIES).map((cur) => (
              <Chip key={cur} label={cur} selected={currency === cur} onPress={() => pickCurrency(cur)} testID={`setup-currency-${cur}`} />
            ))}
          </View>
          <FormTextField control={c} name="timezone" label={t('setup.country.timezone')} hint={t('setup.country.timezoneHint')} autoCapitalize="none" />
        </>
      ) : null}

      <SearchBar value={search} onChangeText={setSearch} placeholder={t('setup.country.search')} testID="setup-country-search" />
      <View>
        {shown.map((x) => (
          <ListRow
            key={x.code}
            title={x.label}
            meta={[x.currency]}
            trailing={x.code === code ? <Icon name="check" size={20} color={theme.colors.primary500} /> : undefined}
            onPress={() => pick(x)}
            testID={`setup-country-${x.code}`}
          />
        ))}
        <ListRow
          title={t('setup.country.other')}
          meta={[t('setup.country.otherDetail')]}
          trailing={other ? <Icon name="check" size={20} color={theme.colors.primary500} /> : undefined}
          onPress={pickOther}
          testID="setup-country-other"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
