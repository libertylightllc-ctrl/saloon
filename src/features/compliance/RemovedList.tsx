import { useTranslation } from 'react-i18next';

import { useWorkspace } from '@/features/auth/session';
import { useDates } from '@/lib/useDates';
import { Button, FormError, ListRow, SectionHeader, useToast } from '@/ui';

import { useRemovals, useRestoreDocument } from './api';
import { useDocName } from './labels';

/** Items deleted from the register, each with "Put back" (its details come back with it). Hidden when there are none. */
export function RemovedList() {
  const { t } = useTranslation();
  const toast = useToast();
  const dates = useDates();
  const docName = useDocName();
  const { business, branch } = useWorkspace();
  const removed = useRemovals(business.id);
  const restore = useRestoreDocument(business.id, branch.id);
  const rows = removed.data ?? [];
  if (rows.length === 0) return null;
  return (
    <>
      <SectionHeader title={t('compliance.removed')} />
      <FormError error={restore.error} />
      {rows.map((r) => (
        <ListRow
          key={r.id}
          testID={`removed-${r.doc_type}-${r.holder_name}`}
          title={docName(r.doc_type)}
          meta={[
            [r.holder_name, t('compliance.removedLine', { date: dates.at(r.created_at, business.timezone, 'd MMM yyyy') })].join(' · '),
            ...(r.reason ? [r.reason] : []),
          ]}
          trailing={
            <Button
              label={t('compliance.restore')}
              icon="rotate"
              variant="row"
              size="sm"
              loading={restore.isPending && restore.variables === r.id}
              onPress={() => restore.mutate(r.id, { onSuccess: () => toast(t('compliance.restored')) })}
              testID={`restore-${r.doc_type}-${r.holder_name}`}
            />
          }
        />
      ))}
    </>
  );
}
