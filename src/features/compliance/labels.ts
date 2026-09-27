import { useTranslation } from 'react-i18next';

import type { StatusKey } from '@/ui';

import type { DocStatus } from './api';

export const TEMPLATE_TYPES = ['trade_licence', 'ejari', 'pest_control', 'civil_defence', 'health_card', 'visa', 'vaccination'] as const;

export const DOC_STATUS: Record<DocStatus, StatusKey> = {
  valid: 'valid',
  due_soon: 'due_soon',
  expired: 'expired',
  missing: 'overdue',
  missing_date: 'low',
  evidence_missing: 'pending_approval',
};

/** Template document names in the app language; the owner's own records keep their name. */
export function useDocName() {
  const { t } = useTranslation();
  return (type: string) =>
    (TEMPLATE_TYPES as readonly string[]).includes(type) ? t(`compliance.types.${type as (typeof TEMPLATE_TYPES)[number]}`) : type;
}
