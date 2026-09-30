import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { useCreateStaffLogin } from '@/features/team/api';
import { formatBps, parsePercent } from '@/lib/money';
import { spacing } from '@/theme';
import { Button, Chip, FormError, HeaderBand, MoneyInput, QueryState, Screen, SegmentTabs, SwitchRow, Text, TextField, useToast } from '@/ui';

import { ROLE_TITLES, useSaveEmployee, useStaffDirectory, type RoleTitle, type StaffMember } from './api';
import { useRoleTitle } from './labels';
import { accessFor, cleanUsername, LoginFields, loginValid, type LoginDraft } from './LoginFields';

type Who = 'staff' | 'accountant';

/**
 * Add a person — with their pay and, if they will use the app, their login, in one go — or edit pay terms (owner).
 * An outside accountant is added with a login only (no pay record).
 */
export function StaffFormScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { business } = useWorkspace();
  const staff = useStaffDirectory(business.id);
  return (
    <Screen header={<HeaderBand title={t(id ? 'staff.editTitle' : 'staff.newTitle')} onBack />}>
      {id ? (
        <QueryState query={staff}>{(rows) => <StaffForm person={rows.find((s) => s.employee_id === id) ?? null} />}</QueryState>
      ) : (
        <StaffForm person={null} />
      )}
    </Screen>
  );
}

function StaffForm({ person }: { person: StaffMember | null }) {
  const { t } = useTranslation();
  const toast = useToast();
  const router = useRouter();
  const roleTitle = useRoleTitle();
  const { business, branch } = useWorkspace();
  const save = useSaveEmployee(business.id, branch.id);
  const createLogin = useCreateStaffLogin(business.id, branch.id);
  const [who, setWho] = useState<Who>('staff');
  const [name, setName] = useState(person?.full_name ?? '');
  const [code, setCode] = useState(person?.employee_code ?? '');
  const [title, setTitle] = useState<RoleTitle>(person?.role_title ?? 'staff');
  const [salary, setSalary] = useState<number | null>(person?.base_salary_minor ?? null);
  const [commission, setCommission] = useState(person ? formatBps(person.commission_bps).replace('%', '') : '');
  const [wps, setWps] = useState(person?.wps_required ?? false);
  const [phone, setPhone] = useState(person?.phone ?? '');
  const [active, setActive] = useState(person?.active ?? true);
  const [canLogin, setCanLogin] = useState(false);
  const [login, setLogin] = useState<LoginDraft>({ access: 'staff', username: '', password: '' });
  const [accessTouched, setAccessTouched] = useState(false);
  /** Saved already while the login still failed (a taken username): Save again only retries the login. */
  const [savedId, setSavedId] = useState<string | null>(null);

  const accountant = !person && who === 'accountant';
  const withLogin = accountant || (!person && canLogin);
  const bps = commission.trim() === '' ? 0 : parsePercent(commission);
  const phoneOk = phone.trim() === '' || /^\+?[0-9 ]{7,20}$/.test(phone.trim());
  const ok =
    name.trim().length > 0 &&
    (accountant || (bps !== null && phoneOk && (salary === null || salary >= 0))) &&
    (!withLogin || loginValid(login));

  const chooseTitle = (r: RoleTitle) => {
    setTitle(r);
    if (!accessTouched) setLogin((l) => ({ ...l, access: accessFor(r) }));
  };

  const makeLogin = (employeeId: string | undefined) =>
    createLogin.mutateAsync({
      display_name: name.trim(),
      username: cleanUsername(login.username),
      password: login.password,
      role: accountant ? 'accountant' : login.access,
      commission_bps: 0,
      colour: null,
      ...(employeeId ? { employee_id: employeeId } : {}),
    });

  const submit = async () => {
    try {
      if (accountant) {
        const r = await makeLogin(undefined);
        toast(t('team.created', { username: r.username, code: business.code }));
        router.replace('/staff');
        return;
      }
      const id = await save.mutateAsync({
        id: person?.employee_id ?? savedId ?? undefined,
        full_name: name.trim(),
        employee_code: code.trim() || null,
        role_title: title,
        base_salary_minor: salary ?? 0,
        commission_bps: bps ?? 0,
        wps_required: wps,
        phone: phone.trim() || null,
        active,
      });
      setSavedId(id);
      if (withLogin) {
        const r = await makeLogin(id);
        toast(t('staff.savedWithLogin', { name: name.trim(), username: r.username }));
      } else {
        toast(t('staff.saved'));
      }
      // Editing goes back to the profile it came from; a new person opens their profile.
      if (person) router.back();
      else router.replace({ pathname: '/staff/[id]', params: { id } });
    } catch {
      // Shown below the form (FormError); nothing typed is lost.
    }
  };

  return (
    <View style={styles.body}>
      {!person ? (
        <SegmentTabs<Who>
          items={[
            { key: 'staff', label: t('staff.who.staff') },
            { key: 'accountant', label: t('staff.who.accountant') },
          ]}
          value={who}
          onChange={setWho}
          testID="staff-who"
        />
      ) : null}
      <TextField label={t('staff.fields.name')} value={name} onChangeText={setName} maxLength={60} testID="staff-name" />
      {accountant ? (
        <Text variant="small" color="textSecondary">
          {t('staff.accountantHint')}
        </Text>
      ) : (
        <>
          <Text variant="bodyStrong">{t('staff.fields.title')}</Text>
          <View style={styles.chips}>
            {ROLE_TITLES.map((r) => (
              <Chip key={r} label={roleTitle(r)} selected={title === r} onPress={() => chooseTitle(r)} testID={`staff-title-${r}`} />
            ))}
          </View>
          <TextField label={t('staff.fields.code')} value={code} onChangeText={setCode} maxLength={20} testID="staff-code" />
          <MoneyInput label={t('staff.fields.salary')} hint={t('staff.fields.salaryHint')} value={salary} onChange={setSalary} testID="staff-salary" />
          <TextField
            label={t('staff.fields.commission')}
            hint={t('staff.fields.commissionHint')}
            value={commission}
            onChangeText={setCommission}
            keyboardType="decimal-pad"
            error={bps === null ? t('validation.range') : undefined}
            testID="staff-commission"
          />
          <SwitchRow label={t('staff.wps')} hint={t('staff.fields.wpsHint')} value={wps} onChange={setWps} testID="staff-wps" />
          <TextField
            label={t('staff.fields.phone')}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            error={phoneOk ? undefined : t('validation.phone')}
            testID="staff-phone"
          />
          {person && !person.member_id ? (
            <SwitchRow label={t('staff.fields.active')} hint={t('staff.fields.activeHint')} value={active} onChange={setActive} testID="staff-active" />
          ) : null}
          {!person ? (
            <SwitchRow
              label={t('staff.canLogin')}
              hint={t('staff.canLoginHint')}
              value={canLogin}
              onChange={setCanLogin}
              testID="staff-can-login"
            />
          ) : null}
        </>
      )}
      {withLogin ? (
        <LoginFields
          value={login}
          onChange={(next) => {
            if (next.access !== login.access) setAccessTouched(true);
            setLogin(next);
          }}
          choices={accountant ? ['accountant'] : undefined}
        />
      ) : null}
      {savedId && createLogin.isError ? (
        <Text variant="small" color="textSecondary">
          {t('staff.savedLoginFailed', { name: name.trim() })}
        </Text>
      ) : null}
      <FormError error={save.error ?? createLogin.error} />
      <Button
        label={t(accountant ? 'team.create' : 'common.save')}
        disabled={!ok}
        loading={save.isPending || createLogin.isPending}
        onPress={() => void submit()}
        testID="staff-save"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
