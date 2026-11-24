import { useTranslation } from 'react-i18next';

import { KpiCard, KpiGrid, SectionHeader, Text } from '@/ui';

import type { Overview } from './api';
import type { SalonFilter } from './salonFilter';

/** Each group and its number on the Overview, in the order a salon moves through them. */
const GROUPS = [
  ['paid', 'salons_plan_active'],
  ['free', 'salons_trial'],
  ['pilot', 'salons_pilot'],
  ['comp', 'salons_comp'],
  ['ended', 'salons_ended'],
  ['closed', 'salons_closed'],
] as const satisfies readonly (readonly [SalonFilter, keyof Overview])[];

/**
 * Salons by status (owner's brief, Part B, B2): paying, in free period, pilot, free for good, ended and closed, each
 * opening Salons on that group. Test salons are left out, as everywhere on the Overview.
 */
export function StatusCards({ o, onOpenSalons }: { o: Overview; onOpenSalons: (filter: SalonFilter) => void }) {
  const { t } = useTranslation();
  return (
    <>
      <SectionHeader title={t('console.status.title')} />
      <KpiGrid minCell={100}>
        {GROUPS.map(([filter, key]) => (
          <KpiCard
            key={filter}
            label={t(`console.status.${filter}`)}
            value={String(o[key])}
            onPress={() => onOpenSalons(filter)}
            testID={`console-status-${filter}`}
          />
        ))}
      </KpiGrid>
      <Text variant="small" color="textSecondary">
        {t('console.status.hint')}
      </Text>
    </>
  );
}
