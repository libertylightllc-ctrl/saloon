import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useWorkspace } from '@/features/auth/session';
import { useCreateStaffLogin } from '@/features/team/api';
import { BottomSheet, Button, FormError, Text, useToast } from '@/ui';

import type { RoleTitle } from './api';
import { accessFor, cleanUsername, LoginFields, loginValid, type LoginDraft } from './LoginFields';

/** Someone on the staff list: the login goes on their own record, with their pay, roster and WPS. */
export interface LoginFor {
  employee_id: string;
  full_name: string;
  role_title: RoleTitle;
}

/** A login for a person already on the staff list (their page → Create login). */
export function CreateLoginSheet({ open, onClose, person }: { open: boolean; onClose: () => void; person: LoginFor }) {
  const { t } = useTranslation();
  return (
    <BottomSheet open={open} onClose={onClose} title={t('team.loginFor', { name: person.full_name })} snapPoints={['90%']}>
      {open ? <CreateLoginForm person={person} onDone={onClose} /> : null}
    </BottomSheet>
  );
}

/** Mounted each time the sheet opens, so the form starts empty. */
function CreateLoginForm({ person, onDone }: { person: LoginFor; onDone: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { business, branch } = useWorkspace();
  const create = useCreateStaffLogin(business.id, branch.id);
  const [draft, setDraft] = useState<LoginDraft>({ access: accessFor(person.role_title), username: '', password: '' });

  return (
    <>
      <Text color="textSecondary">{t('team.fromStaff', { name: person.full_name })}</Text>
      <LoginFields value={draft} onChange={setDraft} />
      <FormError error={create.error} />
      <Button
        label={t('team.create')}
        disabled={!loginValid(draft)}
        loading={create.isPending}
        onPress={() =>
          create.mutate(
            {
              display_name: person.full_name,
              username: cleanUsername(draft.username),
              password: draft.password,
              role: draft.access,
              commission_bps: 0,
              colour: null,
              employee_id: person.employee_id,
            },
            {
              onSuccess: (data) => {
                toast(t('team.created', { username: data.username, code: business.code }));
                onDone();
              },
            },
          )
        }
        testID="create-login"
      />
    </>
  );
}
