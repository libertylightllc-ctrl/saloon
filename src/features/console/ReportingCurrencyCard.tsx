import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { Card, Chip, FormError, QueryState, Text, useToast } from '@/ui';

import { REPORTING_CURRENCIES, type FxRates } from './fx';
import { FxNote } from './FxNote';
import { useFxRates, useSetReportingCurrency } from './overviewApi';

/**
 * Settings → Reporting currency (owner's brief, Part B and H2): the currency the Overview's money is shown in; amounts
 * in other currencies are converted at the day's rate. A tap saves it (written to Changes).
 */
export function ReportingCurrencyCard() {
  const fx = useFxRates();
  return <QueryState query={fx}>{(r) => <Picker fx={r} />}</QueryState>;
}

function Picker({ fx }: { fx: FxRates }) {
  const { t } = useTranslation();
  const toast = useToast();
  const set = useSetReportingCurrency();
  const offered = REPORTING_CURRENCIES.filter((c) => fx.rates[c]);
  return (
    <Card variant="outlined" style={styles.card} testID="console-reporting">
      <Text variant="h4">{t('console.reporting.title')}</Text>
      <Text color="textSecondary">{t('console.reporting.body')}</Text>
      <View style={styles.chips}>
        {offered.map((c) => (
          <Chip
            key={c}
            label={c}
            selected={fx.reporting_currency === c}
            onPress={() =>
              c !== fx.reporting_currency &&
              set.mutate(c, { onSuccess: () => toast(t('console.reporting.saved', { currency: c })) })
            }
            testID={`console-reporting-${c}`}
          />
        ))}
      </View>
      <FormError error={set.error} />
      <FxNote fx={fx} testID="console-reporting-rates" />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
