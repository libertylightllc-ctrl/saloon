import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { isLanguage } from '@/lib/i18n';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import { Button, Card, FormError, ListRow, QueryState, StatusPill, Text, TextField, useToast } from '@/ui';

import {
  useCreatePilotCode,
  useDecidePilotApplication,
  useDisablePilotCode,
  usePilotApplications,
  usePilotCodes,
  type PilotApplication,
} from './api';

/** A code's shape, as an example in the field (not words to translate). */
const EXAMPLE_CODE = 'PILOT-DXB-07';

/** The approved salon's message, in the language it chose, ready to send on WhatsApp. */
function useWelcome() {
  const { i18n } = useTranslation();
  return (a: Pick<PilotApplication, 'name' | 'language'>, code: string, days: number) => {
    const t = i18n.getFixedT(isLanguage(a.language) ? a.language : 'en');
    return t('console.pilot.message', { name: a.name, code, days, link: t('plan.pilot.link') });
  };
}

/**
 * The pilot (full update, Phase 6 g): applications from the website (approve: a one-use code and a ready WhatsApp
 * message; decline), and the codes — create one, see how often each was used, switch one off.
 */
export function PilotTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const dates = useDates();
  const codes = usePilotCodes();
  const apps = usePilotApplications();
  const create = useCreatePilotCode();
  const disable = useDisablePilotCode();
  const decide = useDecidePilotApplication();
  const welcome = useWelcome();
  const [code, setCode] = useState('');
  const [days, setDays] = useState('');
  const [uses, setUses] = useState('1');
  const [expires, setExpires] = useState('');
  const [message, setMessage] = useState<{ text: string; whatsapp: string } | null>(null);
  const expiresOk = expires.trim() === '' || /^\d{4}-\d{2}-\d{2}$/.test(expires.trim());

  return (
    <View style={styles.body}>
      <Text variant="h4">{t('console.pilot.applications')}</Text>
      {message ? (
        <Card variant="outlined" style={styles.card} testID="console-pilot-message">
          <Text selectable>{message.text}</Text>
          <Button
            label={t('console.pilot.openWhatsApp')}
            icon="messageCircle"
            href={`https://wa.me/${message.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(message.text)}`}
            external
          />
          <Button label={t('common.close')} variant="ghost" onPress={() => setMessage(null)} />
        </Card>
      ) : null}
      <QueryState query={apps} empty={t('console.pilot.noApplications')}>
        {(rows) => (
          <View style={styles.list}>
            {rows.map((a) => (
              <Card key={a.id} variant="outlined" style={styles.card} testID={`pilot-app-${a.salon_name}`}>
                <View style={styles.row}>
                  <Text variant="bodyStrong" style={styles.flex}>
                    {a.salon_name} · {a.name}
                  </Text>
                  <StatusPill
                    status={a.status === 'approved' ? 'valid' : a.status === 'declined' ? 'cancelled' : 'pending_approval'}
                    label={t(`console.pilot.status.${a.status}`)}
                  />
                </View>
                <Text variant="small" color="textSecondary" selectable>
                  {[
                    t(`console.pilot.emirates.${a.emirate}` as 'console.pilot.emirates.dubai'),
                    a.area,
                    t(`console.pilot.types.${a.salon_type}` as 'console.pilot.types.barber'),
                    t('console.pilot.staff', { count: a.staff_count }),
                    a.whatsapp,
                    a.language.toUpperCase(),
                    a.whatsapp_ok ? t('console.pilot.whatsappOk') : null,
                    dates.at(a.created_at, 'Asia/Dubai', 'd MMM yyyy'),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                {a.code ? <Text variant="small">{t('console.access.code', { code: a.code })}</Text> : null}
                {a.status === 'new' ? (
                  <View style={styles.row}>
                    <Button
                      size="sm"
                      label={t('console.pilot.approve')}
                      loading={decide.isPending && decide.variables?.id === a.id && decide.variables.approve}
                      onPress={() =>
                        decide.mutate(
                          { id: a.id, approve: true },
                          { onSuccess: (r) => r.code && setMessage({ text: welcome(a, r.code, r.days), whatsapp: r.whatsapp }) },
                        )
                      }
                      testID={`pilot-approve-${a.salon_name}`}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      label={t('console.pilot.decline')}
                      onPress={() => decide.mutate({ id: a.id, approve: false })}
                      testID={`pilot-decline-${a.salon_name}`}
                    />
                  </View>
                ) : null}
              </Card>
            ))}
          </View>
        )}
      </QueryState>
      <FormError error={decide.error} />

      <Text variant="h4">{t('console.pilot.codes')}</Text>
      <Card variant="outlined" style={styles.card} testID="console-pilot-new">
        <TextField label={t('console.pilot.code')} placeholder={EXAMPLE_CODE} value={code} onChangeText={setCode} autoCapitalize="characters" maxLength={40} testID="pilot-new-code" />
        <TextField label={t('console.pilot.days')} placeholder="90" value={days} onChangeText={setDays} keyboardType="number-pad" testID="pilot-new-days" />
        <TextField label={t('console.pilot.maxUses')} value={uses} onChangeText={setUses} keyboardType="number-pad" testID="pilot-new-uses" />
        <TextField label={t('console.pilot.expires')} placeholder="2027-01-31" value={expires} onChangeText={setExpires} maxLength={10} />
        <FormError error={create.error} />
        <Button
          label={t('console.pilot.create')}
          disabled={!expiresOk}
          loading={create.isPending}
          onPress={() =>
            create.mutate(
              {
                code: code.trim() || undefined,
                days: days.trim() ? Number(days) : undefined,
                max_uses: Number(uses) || 1,
                expires_on: expires.trim() || undefined,
              },
              { onSuccess: (c) => { toast(t('console.pilot.created', { code: c })); setCode(''); } },
            )
          }
          testID="pilot-new-create"
        />
      </Card>
      <QueryState query={codes} empty={t('console.pilot.noCodes')}>
        {(rows) => (
          <View style={styles.list}>
            {rows.map((c) => (
              <ListRow
                key={c.code}
                title={c.code}
                meta={[
                  [t('console.pilot.codeDays', { count: c.days }), t('console.pilot.used', { uses: c.uses, max: c.max_uses })].join(' · '),
                  ...(c.expires_on ? [t('console.pilot.until', { date: dates.day(c.expires_on, 'd MMM yyyy') })] : []),
                  ...(c.note ? [c.note] : []),
                ]}
                badges={
                  c.disabled ? (
                    <StatusPill status="cancelled" label={t('console.pilot.disabled')} />
                  ) : (
                    <Button size="sm" variant="ghost" label={t('console.pilot.disable')} onPress={() => disable.mutate(c.code)} testID={`pilot-disable-${c.code}`} />
                  )
                }
                testID={`pilot-code-${c.code}`}
              />
            ))}
          </View>
        )}
      </QueryState>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  list: { gap: spacing.sm },
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  flex: { flex: 1 },
});
