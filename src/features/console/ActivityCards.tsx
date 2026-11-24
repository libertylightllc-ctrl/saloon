import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDates } from '@/lib/useDates';
import { KpiCard, KpiGrid } from '@/ui';

import type { SalonActivity } from './overviewApi';
import { SalonListSheet } from './SalonListSheet';

/**
 * B3 Active salons: used in the last 7 days (someone signed in, opened the app or recorded anything), of the open
 * salons, and in the last 30. B7 At risk: paying, free or pilot salons with nothing done for 14 days or more; opens
 * the list, the quietest first, each opening its salon (owner's brief, Part B).
 */
export function ActivityCards({
  activity: a,
  signedIn7d,
  onOpenSalon,
}: {
  activity: SalonActivity;
  signedIn7d: number;
  onOpenSalon: (code: string) => void;
}) {
  const { t } = useTranslation();
  const dates = useDates();
  const [riskOpen, setRiskOpen] = useState(false);
  return (
    <>
      <KpiGrid>
        <KpiCard
          icon="userCheck"
          label={t('console.activity.active')}
          value={String(a.active_7d)}
          sub={[t('console.activity.activeSub', { open: a.open, month: a.active_30d }), t('console.activity.signedIn', { count: signedIn7d })].join('\n')}
          subLines={4}
          testID="console-active"
        />
        <KpiCard
          icon="warning"
          label={t('console.activity.atRisk')}
          value={String(a.at_risk_count)}
          sub={t('console.activity.atRiskSub')}
          subLines={5}
          onPress={() => setRiskOpen(true)}
          testID="console-at-risk"
        />
      </KpiGrid>
      <SalonListSheet
        open={riskOpen}
        title={t('console.activity.atRisk')}
        lines={a.at_risk.map((s) => ({
          key: s.code,
          title: s.name,
          meta: [
            s.code,
            t(`console.status.${s.status}`),
            s.last_active ? t('console.activity.lastUsed', { date: dates.at(s.last_active, s.timezone, 'd MMM yyyy') }) : t('console.activity.neverUsed'),
          ],
          onPress: () => {
            setRiskOpen(false);
            onOpenSalon(s.code);
          },
        }))}
        note={a.at_risk_count > a.at_risk.length ? t('console.activity.quietest', { shown: a.at_risk.length, total: a.at_risk_count }) : undefined}
        onClose={() => setRiskOpen(false)}
        testID="console-at-risk-list"
      />
    </>
  );
}
