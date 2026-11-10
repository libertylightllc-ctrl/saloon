import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { isUae } from '@/lib/countries';
import { can } from '@/lib/permissions';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import { Button, HeaderBand, IconButton, KpiCard, KpiGrid, ListRow, QueryState, Screen, SectionHeader, SegmentTabs, StatusPill } from '@/ui';

import { useCompliance, type Slot } from './api';
import { BinderTab } from './BinderTab';
import { DocumentActions } from './DocumentActions';
import { HygieneTab } from './HygieneTab';
import { DOC_STATUS, useDocName } from './labels';
import { RemovedList } from './RemovedList';
import { WpsMontajiTab } from './WpsMontajiTab';

type Tab = 'register' | 'binder' | 'hygiene' | 'wps';

/**
 * Compliance: expiry register, inspection binder, hygiene log, WPS & Montaji. Owner and manager keep the records, the
 * accountant views them; the front desk and stylists see only the hygiene log, which the accountant does not sign.
 */
export function ComplianceScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { business, role } = useWorkspace();
  const owner = can(role, 'viewCompliance');
  // WPS salary proof (for those who pay salaries) and Montaji product numbers are UAE rules.
  const tabs: Tab[] = [
    ...(owner ? (['register', 'binder'] as const) : []),
    ...(can(role, 'signHygiene') ? (['hygiene'] as const) : []),
    ...(owner && can(role, 'payPayroll') && isUae(business.country_code) ? (['wps'] as const) : []),
  ];
  const [tab, setTab] = useState<Tab>(tabs.includes(params.tab as Tab) ? (params.tab as Tab) : tabs[0]!);
  const slots = useCompliance(business.id, owner);

  return (
    <Screen
      refreshing={slots.isRefetching}
      onRefresh={() => void slots.refetch()}
      header={
        <HeaderBand title={t('compliance.title')} subtitle={t('compliance.subtitle')} onBack>
          {tabs.length > 1 ? (
            <SegmentTabs<Tab> items={tabs.map((k) => ({ key: k, label: t(`compliance.tabs.${k}`) }))} value={tab} onChange={setTab} testID="compliance-tab" />
          ) : null}
        </HeaderBand>
      }
    >
      {tab === 'register' ? <Register /> : null}
      {tab === 'binder' ? <BinderTab /> : null}
      {tab === 'hygiene' ? <HygieneTab /> : null}
      {tab === 'wps' ? <WpsMontajiTab /> : null}
    </Screen>
  );
}

function Register() {
  const { t } = useTranslation();
  const router = useRouter();
  const dates = useDates();
  const docName = useDocName();
  const { business, role } = useWorkspace();
  // The accountant views the records; owner and manager keep them.
  const manage = can(role, 'manageCompliance');
  const slots = useCompliance(business.id);
  // The item whose "⋯" was tapped (by key, so the sheet always shows its latest details).
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const open = (s: Slot) =>
    router.push({
      pathname: '/compliance/doc',
      params: { type: s.doc_type, holder: s.holder_type, branch: s.branch_id ?? '', employee: s.employee_id ?? '' },
    });
  return (
    <QueryState query={slots}>
      {(rows) => {
        const ok = rows.filter((s) => s.status === 'valid' || s.status === 'due_soon').length;
        const readiness = rows.length ? Math.round((100 * ok) / rows.length) : 100;
        const row = (s: Slot) => (
          <ListRow
            key={s.slot_key}
            testID={`doc-${s.doc_type}-${s.holder_name}`}
            title={docName(s.doc_type)}
            meta={[
              [s.holder_type === 'employee' ? s.holder_name : null, s.number].filter(Boolean).join(' · ') || t('compliance.noNumber'),
              ...(s.expires_on
                ? [s.days_left !== null && s.days_left < 0
                    ? t('compliance.expiredOn', { date: dates.day(s.expires_on, 'd MMM yyyy') })
                    : t('compliance.expiresOn', { date: dates.day(s.expires_on, 'd MMM yyyy'), n: s.days_left })]
                : []),
            ]}
            badges={<StatusPill status={DOC_STATUS[s.status]} label={t(`compliance.status.${s.status}`)} />}
            action={
              manage ? (
                <IconButton
                  icon="ellipsis"
                  variant="plain"
                  accessibilityLabel={t('compliance.actionsFor', { name: docName(s.doc_type) })}
                  onPress={() => setMenuKey(s.slot_key)}
                  testID={`doc-menu-${s.doc_type}-${s.holder_name}`}
                />
              ) : undefined
            }
            chevron={manage}
            onPress={manage ? () => open(s) : undefined}
          />
        );
        return (
          <View style={styles.body}>
            <KpiGrid>
              <KpiCard icon="shield" label={t('compliance.readiness')} value={`${readiness}%`} sub={t('compliance.readinessSub', { ok, total: rows.length })} testID="compliance-readiness" />
            </KpiGrid>
            {manage ? (
              <Button label={t('compliance.addOther')} icon="plus" variant="ghost" size="md" onPress={() => router.push({ pathname: '/compliance/doc', params: { new: '1' } })} testID="doc-new" />
            ) : null}
            <SectionHeader title={t('compliance.salon')} />
            {rows.filter((s) => s.holder_type !== 'employee').map(row)}
            <SectionHeader title={t('compliance.staff')} />
            {rows.filter((s) => s.holder_type === 'employee').map(row)}
            {manage ? <RemovedList /> : null}
            <DocumentActions slot={rows.find((s) => s.slot_key === menuKey) ?? null} onClose={() => setMenuKey(null)} />
          </View>
        );
      }}
    </QueryState>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.sm },
});
