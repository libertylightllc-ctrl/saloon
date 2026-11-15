import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { useCreateStaffLogin } from '@/features/team/api';
import { isUae } from '@/lib/countries';
import { businessDate, type BusinessDate } from '@/lib/dates';
import { formatBps, parsePercent } from '@/lib/money';
import { spacing } from '@/theme';
import { Button, Chip, DateField, FormError, HeaderBand, MoneyInput, QueryState, Screen, SwitchRow, Text, TextField, useToast } from '@/ui';

import { ROLE_TITLES, useSaveEmployee, useStaffDirectory, type RoleTitle, type StaffMember } from './api';
import { useRoleTitle } from './labels';
import { accessFor, cleanUsername, LoginFields, loginValid, type LoginDraft } from './LoginFields';

/**
 * Add a person — with their pay and, if they will use the app, their login, in one go — or edit pay terms (owner).
 * The job picks the login type to start with (B7). The Accountant job is the one way to make an accountant: a login
 * only, with no pay record (in-house or outside bookkeeper).
 */
export function StaffFormScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { business } = useWorkspace();
  const staff = useStaffDirectory(business.id);
  const header = <HeaderBand title={t(id ? 'staff.editTitle' : 'staff.newTitle')} onBack />;
  if (!id) return <StaffForm header={header} person={null} />;
  if (!staff.data) {
    return (
      <Screen header={header}>
        <QueryState query={staff}>{() => null}</QueryState>
      </Screen>
    );
  }
  return <StaffForm header={header} person={staff.data.find((s) => s.employee_id === id) ?? null} />;
}

function StaffForm({ header, person }: { header: ReactNode; person: StaffMember | null }) {
  const { t } = useTranslation();
  const toast = useToast();
  const router = useRouter();
  const roleTitle = useRoleTitle();
  const { business, branch } = useWorkspace();
  const save = useSaveEmployee(business.id, branch.id);
  const createLogin = useCreateStaffLogin(business.id, branch.id);
  const [name, setName] = useState(person?.full_name ?? '');
  const [code, setCode] = useState(person?.employee_code ?? '');
  const [title, setTitle] = useState<RoleTitle>(person?.role_title ?? 'staff');
  const [salary, setSalary] = useState<number | null>(person?.base_salary_minor ?? null);
  const [commission, setCommission] = useState(person ? formatBps(person.commission_bps).replace('%', '') : '');
  const [wps, setWps] = useState(person?.wps_required ?? false);
  const [phone, setPhone] = useState(person?.phone ?? '');
  // Archiving and bringing back are on the person's page (Remove from staff / Bring back).
  const active = person?.active ?? true;
  // Base pay follows the days employed (C1): the day they started, and the day they left once switched off.
  const [startedOn, setStartedOn] = useState<BusinessDate | ''>(person?.started_on ?? businessDate(new Date(), business.timezone));
  const [leftOn, setLeftOn] = useState<BusinessDate | ''>(person?.left_on ?? '');
  const [canLogin, setCanLogin] = useState(false);
  const [loginTouched, setLoginTouched] = useState(false);
  const [login, setLogin] = useState<LoginDraft>({ access: 'staff', username: '', password: '' });
  const [accessTouched, setAccessTouched] = useState(false);
  /** Saved already while the login still failed (a taken username): Save again only retries the login. */
  const [savedId, setSavedId] = useState<string | null>(null);

  const accountant = !person && title === 'accountant';
  const withLogin = accountant || (!person && canLogin);
  const bps = commission.trim() === '' ? 0 : parsePercent(commission);
  const phoneOk = phone.trim() === '' || /^\+?[0-9 ]{7,20}$/.test(phone.trim());
  const ok =
    name.trim().length > 0 &&
    (accountant || (bps !== null && phoneOk && (salary === null || salary >= 0))) &&
    (!withLogin || loginValid(login));

  const chooseTitle = (r: RoleTitle) => {
    setTitle(r);
    const access = accessFor(r);
    // An assistant has no login to start with; still changeable.
    if (!loginTouched && !person) setCanLogin(access !== null && canLogin);
    if (!accessTouched && access) setLogin((l) => ({ ...l, access }));
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
        wps_required: wps && isUae(business.country_code),
        phone: phone.trim() || null,
        active,
        ...(startedOn ? { started_on: startedOn } : {}),
        ...(!active ? { left_on: leftOn || null } : {}),
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

  // Save stays pinned at the bottom, like the other forms.
  const saveButton = (
      <Button
        label={t(accountant ? 'team.create' : 'common.save')}
        disabled={!ok}
        loading={save.isPending || createLogin.isPending}
        onPress={() => void submit()}
        testID="staff-save"
      />
  );
  return (
    <Screen header={header} footer={saveButton}>
      <View style={styles.body}>
        <TextField label={t('staff.fields.name')} value={name} onChangeText={setName} maxLength={60} testID="staff-name" />
        <Text variant="bodyStrong">{t('staff.fields.title')}</Text>
        <View style={styles.chips}>
          {ROLE_TITLES.map((r) => (
            <Chip key={r} label={roleTitle(r)} selected={title === r} onPress={() => chooseTitle(r)} testID={`staff-title-${r}`} />
          ))}
        </View>
        {accountant ? (
          <Text variant="small" color="textSecondary">
            {t('staff.accountantHint')}
          </Text>
        ) : (
          <>
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
            {isUae(business.country_code) ? (
              <SwitchRow label={t('staff.wps')} hint={t('staff.fields.wpsHint')} value={wps} onChange={setWps} testID="staff-wps" />
            ) : null}
            <TextField
              label={t('staff.fields.phone')}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              error={phoneOk ? undefined : t('validation.phone')}
              testID="staff-phone"
            />
            <DateField
              label={t('staff.fields.startedOn')}
              hint={t('staff.fields.startedOnHint')}
              value={startedOn}
              onChange={setStartedOn}
              testID="staff-started-on"
            />
            {person && !active ? (
              <DateField
                label={t('staff.fields.leftOn')}
                value={leftOn}
                onChange={setLeftOn}
                {...(startedOn ? { min: startedOn } : {})}
                testID="staff-left-on"
              />
            ) : null}
            {!person ? (
              <SwitchRow
                label={t('staff.canLogin')}
                hint={t('staff.canLoginHint')}
                value={canLogin}
                onChange={(on) => {
                  setLoginTouched(true);
                  setCanLogin(on);
                }}
                testID="staff-can-login"
              />
            ) : null}
          </>
        )}
        {withLogin ? (
          <LoginFields
            value={accountant ? { ...login, access: 'accountant' } : login}
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
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
