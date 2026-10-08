import { useTranslation } from 'react-i18next';

import { useWorkspace } from '@/features/auth/session';
import { formatMoney } from '@/lib/money';
import { Text } from '@/ui';

import { usePlanStatus } from './api';
import { canOfferPlans } from './storePolicy';

/**
 * Where a staff login is made: once the salon has as many people as its price covers, what one more adds to the plan
 * (owner, 2026-10-08: the plan is priced by the people who sign in).
 */
export function PlanPeopleNote() {
  const { t } = useTranslation();
  const { business } = useWorkspace();
  const plan = usePlanStatus(business.id);
  const p = plan.data;
  if (!canOfferPlans || !p || p.people < p.included_people) return null;
  return (
    <Text variant="small" color="textSecondary" testID="login-plan-note">
      {t('plan.extraPerson', {
        included: p.included_people,
        people: p.people,
        extra: formatMoney(p.extra_person_minor, p.currency),
      })}
    </Text>
  );
}
