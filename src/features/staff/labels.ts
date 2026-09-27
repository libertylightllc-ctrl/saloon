import { useTranslation } from 'react-i18next';

import { useTerms } from '@/features/mode/useTerms';

import type { RoleTitle } from './api';

/** "Barber" / "Stylist" follow the mode; the other job titles are fixed words. */
export function useRoleTitle() {
  const { t } = useTranslation();
  const terms = useTerms();
  return (title: RoleTitle) => (title === 'staff' ? terms.staff : t(`staff.roles.${title}`));
}

/** Sunday first, as the database stores weekdays (0 = Sunday). */
export const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
