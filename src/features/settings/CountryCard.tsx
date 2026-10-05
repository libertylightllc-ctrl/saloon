import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useSession, useWorkspace } from '@/features/auth/session';
import { CountryStep, type CountryValues } from '@/features/setup/CountryStep';
import { useChangeCountry, useCountryChangeAllowed } from '@/features/team/api';
import { countryName, countryOf } from '@/lib/countries';
import { formatBps, parseTaxRate } from '@/lib/money';
import { spacing, useTheme } from '@/theme';
import { BottomSheet, Button, Card, FormError, Icon, Text, useToast } from '@/ui';

/**
 * Branch settings: the salon's country — its currency, time zone and tax (owner, 2026-10-06). It can change until
 * money is recorded (the first sale, expense, purchase or opening cash); amounts already typed in are converted roughly.
 */
export function CountryCard() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const toast = useToast();
  const router = useRouter();
  const { reload } = useSession();
  const { business, branch } = useWorkspace();
  const allowed = useCountryChangeAllowed(business.id);
  const change = useChangeCountry(business.id);
  const [open, setOpen] = useState(false);
  const current = (): CountryValues => ({
    country: business.country_code,
    currency: business.currency,
    timezone: business.timezone,
    tax_name: branch.tax_name,
    tax_rate: formatBps(branch.tax_rate_bps).replace('%', ''),
    tax_inclusive: branch.tax_inclusive,
    tax_id_label: branch.tax_id_label,
  });
  const form = useForm<CountryValues>({ defaultValues: current() });

  const save = (v: CountryValues) =>
    change.mutate(
      {
        country_code: v.country,
        currency: v.currency,
        timezone: v.timezone.trim(),
        tax_name: v.tax_name,
        tax_rate_bps: parseTaxRate(v.tax_rate) ?? 0,
        tax_inclusive: v.tax_inclusive,
        tax_id_label: v.tax_id_label,
      },
      {
        onSuccess: async () => {
          setOpen(false);
          toast(t('branch.country.changed'));
          // The whole app now reads the new currency, time zone and tax; the settings form starts again from them.
          await reload();
          router.replace('/settings/branch');
        },
      },
    );

  return (
    <>
      <Card variant="outlined" style={styles.card} testID="branch-country">
        <View style={styles.row}>
          <Icon name="mapPin" size={22} color={theme.colors.primary500} />
          <View style={styles.flex}>
            <Text variant="h4">
              {countryOf(business.country_code) ? countryName(business.country_code, i18n.language) : t('setup.country.other')}
            </Text>
            <Text variant="small" color="textSecondary">{`${business.currency} · ${business.timezone}`}</Text>
          </View>
        </View>
        {allowed.data === true ? (
          <Button
            label={t('branch.country.change')}
            icon="mapPin"
            variant="secondary"
            size="md"
            onPress={() => {
              form.reset(current());
              change.reset();
              setOpen(true);
            }}
            testID="branch-country-change"
          />
        ) : allowed.data === false ? (
          <Text variant="small" color="textSecondary" testID="branch-country-locked">
            {t('branch.country.locked')}
          </Text>
        ) : null}
      </Card>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={t('branch.country.title')}>
        {open ? (
          <View style={styles.stack}>
            <Text color="textSecondary">{t('branch.country.hint')}</Text>
            <CountryStep control={form.control} setValue={form.setValue} preview={false} />
            <FormError error={change.error} />
            <Button
              label={t('branch.country.save')}
              loading={change.isPending}
              onPress={form.handleSubmit(save)}
              testID="branch-country-save"
            />
          </View>
        ) : null}
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  stack: { gap: spacing.md },
});
