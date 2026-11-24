import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isCurrency } from '@/lib/currencies';
import { changeBps, formatBps, formatMoney } from '@/lib/money';
import { useDates } from '@/lib/useDates';
import { KpiCard, KpiGrid, type KpiDelta } from '@/ui';

import { reportingCurrency, showTotal, totalIn, type FxRates } from './fx';
import type { Revenue } from './overviewApi';
import { SalonListSheet } from './SalonListSheet';

/**
 * The money cards (owner's brief, Part B): B1 monthly income and the year at that rate, with the change since the end
 * of last month; B4 how many salons paid after their free period or pilot; B5 who stopped paying this month (opens
 * the list). Amounts are in the reporting currency, "≈" when converted.
 */
export function MoneyCards({
  revenue: r,
  fx,
  billingOn,
  onOpenSalon,
}: {
  revenue: Revenue;
  fx: FxRates;
  billingOn: boolean;
  onOpenSalon: (code: string) => void;
}) {
  const { t } = useTranslation();
  const dates = useDates();
  const [churnOpen, setChurnOpen] = useState(false);
  const currency = reportingCurrency(fx);
  const now = totalIn(r.mrr, currency, fx.rates);
  const prev = totalIn(r.mrr_prev, currency, fx.rates);
  const change = changeBps(now.minor, prev.minor);
  const delta: KpiDelta | undefined =
    change === null
      ? undefined
      : { label: formatBps(Math.abs(change)), trend: change >= 0 ? 'up' : 'down' };
  const lost = totalIn(r.churn, currency, fx.rates);
  const missing = [...new Set([...now.missing, ...prev.missing, ...lost.missing])];
  const rate = r.conversion.ended
    ? Math.round((r.conversion.paid * 100) / r.conversion.ended)
    : null;

  return (
    <>
      <KpiGrid>
        <KpiCard
          icon="banknote"
          label={t('console.money.mrr')}
          value={showTotal(now)}
          delta={delta}
          sub={[
            t('console.money.arr', { amount: showTotal({ ...now, minor: now.minor * 12 }) }),
            t('console.money.paying', { count: r.paying }),
            t('console.money.lastMonth', { amount: showTotal(prev) }),
            r.paying_unpriced ? t('console.money.unpriced', { count: r.paying_unpriced }) : null,
            missing.length ? t('console.money.noRate', { list: missing.join(', ') }) : null,
          ]
            .filter(Boolean)
            .join('\n')}
          subLines={6}
          testID="console-mrr"
        />
        <KpiCard
          icon="percent"
          label={t('console.money.conversion')}
          value={rate === null ? '—' : `${rate}%`}
          sub={[
            t('console.money.conversionSub', {
              paid: r.conversion.paid,
              count: r.conversion.ended,
            }),
            billingOn ? null : t('console.money.billingOff'),
          ]
            .filter(Boolean)
            .join('\n')}
          subLines={5}
          testID="console-conversion"
        />
        <KpiCard
          icon="logOut"
          label={t('console.money.churn')}
          value={String(r.churn.length)}
          sub={
            r.churn.length
              ? t('console.money.churnSub', { amount: showTotal(lost) })
              : t('console.money.churnNone')
          }
          onPress={() => setChurnOpen(true)}
          testID="console-churn"
        />
      </KpiGrid>
      <SalonListSheet
        open={churnOpen}
        title={t('console.money.churn')}
        lines={r.churn.map((c) => ({
          key: c.code,
          title: c.name,
          meta: [
            c.code,
            t('console.money.stoppedOn', { date: dates.day(c.stopped_on, 'd MMM yyyy') }),
            t(`console.money.now.${c.status}`),
            isCurrency(c.currency)
              ? t('console.money.perMonth', { amount: formatMoney(c.minor, c.currency) })
              : '',
          ].filter(Boolean),
          onPress: () => {
            setChurnOpen(false);
            onOpenSalon(c.code);
          },
        }))}
        onClose={() => setChurnOpen(false)}
        testID="console-churn-list"
      />
    </>
  );
}
