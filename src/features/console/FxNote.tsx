import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';

import { useDates } from '@/lib/useDates';
import { Text } from '@/ui';

import { RATES_SITE, type FxRates } from './fx';

/**
 * Where converted amounts come from: "≈ converted at the rates of 25 Nov 2026 · Rates by Exchange Rate API", or,
 * before the first day's rates arrive, which currencies convert so far. The credit opens the rates service's site
 * (its terms ask for it).
 */
export function FxNote({ fx, testID }: { fx: FxRates; testID?: string }) {
  const { t } = useTranslation();
  const dates = useDates();
  const body = fx.day
    ? t('console.fx.ratesOf', { date: dates.day(fx.day, 'd MMM yyyy') })
    : t('console.fx.fixedOnly', { list: fx.fixed.filter((c) => c !== 'USD').join(', ') });
  return (
    <Text variant="small" color="textSecondary" testID={testID}>
      {`${body} `}
      <Text variant="small" color="primary500" onPress={() => void Linking.openURL(RATES_SITE)} accessibilityRole="link">
        {t('console.fx.credit')}
      </Text>
    </Text>
  );
}
