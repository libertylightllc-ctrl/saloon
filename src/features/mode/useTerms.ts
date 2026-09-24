import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useThemeMode } from '@/theme';

/** Words that follow the mode: Barber/Stylist, Chair/Station… (01-PRODUCT §1.2). */
export function useTerms() {
  const { mode } = useThemeMode();
  const { t } = useTranslation();
  return useMemo(
    () => ({
      staff: t(`terms.staff.${mode}`),
      staffPlural: t(`terms.staffPlural.${mode}`),
      station: t(`terms.station.${mode}`),
      shop: t(`terms.shop.${mode}`),
      anyStaff: t(`terms.anyStaff.${mode}`),
    }),
    [mode, t],
  );
}
