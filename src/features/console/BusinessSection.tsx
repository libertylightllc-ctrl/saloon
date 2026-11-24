import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { QueryState, SectionHeader } from '@/ui';

import { ActivityCards } from './ActivityCards';
import { FxNote } from './FxNote';
import { MoneyCards } from './MoneyCards';
import { useFxRates, useRevenue, useSalonActivity } from './overviewApi';

/**
 * The top of the Overview (owner's brief, Part B): the numbers a subscription business runs on. Each group loads on
 * its own, so one that is slow or fails leaves the rest showing. Money is in the reporting currency (Settings).
 */
export function BusinessSection({
  billingOn,
  signedIn7d,
  onOpenSalon,
}: {
  billingOn: boolean;
  /** Accounts signed in this week (the Overview's own number). */
  signedIn7d: number;
  onOpenSalon: (code: string) => void;
}) {
  const { t } = useTranslation();
  const fx = useFxRates();
  const revenue = useRevenue();
  const activity = useSalonActivity();
  return (
    <View style={styles.body}>
      <SectionHeader title={t('console.business.title')} />
      <QueryState query={fx}>
        {(rates) => (
          <>
            <QueryState query={revenue}>
              {(r) => <MoneyCards revenue={r} fx={rates} billingOn={billingOn} onOpenSalon={onOpenSalon} />}
            </QueryState>
            <FxNote fx={rates} testID="console-fx-note" />
          </>
        )}
      </QueryState>
      <QueryState query={activity}>{(a) => <ActivityCards activity={a} signedIn7d={signedIn7d} onOpenSalon={onOpenSalon} />}</QueryState>
    </View>
  );
}

const styles = StyleSheet.create({ body: { gap: spacing.md } });
