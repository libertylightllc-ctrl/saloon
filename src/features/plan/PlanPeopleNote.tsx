import { useTranslation } from 'react-i18next';

import { useWorkspace } from '@/features/auth/session';
import { formatMoney } from '@/lib/money';
import { Text } from '@/ui';

import { showsBilling, usePlanStatus } from './api';
import { canOfferPlans } from './storePolicy';

/**
 * Where a staff login is made (at the branch open now): once that branch has as many people as its price covers, what
 * one more adds (owner, 2026-10-08: priced by the people who sign in; per branch since 2026-10-25). Only while billing
 * is on and the salon is not free.
 */
export function PlanPeopleNote() {
  const { t } = useTranslation();
  const { business, branch } = useWorkspace();
  const plan = usePlanStatus(business.id);
  const p = plan.data;
  const here = p?.branches.find((b) => b.branch_id === branch.id);
  if (!canOfferPlans || !p || !here || !showsBilling(p) || here.people < p.included_people) return null;
  return (
    <Text variant="small" color="textSecondary" testID="login-plan-note">
      {t('plan.extraPerson', {
        included: p.included_people,
        people: here.people,
        extra: formatMoney(p.extra_person_minor, p.currency),
      })}
    </Text>
  );
}
