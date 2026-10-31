import { useTranslation } from 'react-i18next';

import { FormError, SwitchRow, useToast } from '@/ui';

import { useSetTestSalon, useTestSalons } from './api';

/**
 * "Test salon" on a salon in Console → Salons (final brief E1): left out of the Overview numbers and the pilot's
 * places, labelled "Test" in the lists. The salon itself works as before.
 */
export function TestSalonSwitch({ salon }: { salon: { business_id: string; name: string } }) {
  const { t } = useTranslation();
  const toast = useToast();
  const tests = useTestSalons();
  const set = useSetTestSalon();
  const on = tests.data?.has(salon.business_id) ?? false;
  return (
    <>
      <SwitchRow
        label={t('console.salons.testSwitch')}
        hint={t('console.salons.testHint')}
        value={on}
        disabled={!tests.data || set.isPending}
        onChange={(test) =>
          set.mutate(
            { businessId: salon.business_id, test },
            { onSuccess: () => toast(t(test ? 'console.salons.testMarked' : 'console.salons.testUnmarked', { name: salon.name })) },
          )
        }
        testID="console-test-salon"
      />
      <FormError error={set.error} />
    </>
  );
}
