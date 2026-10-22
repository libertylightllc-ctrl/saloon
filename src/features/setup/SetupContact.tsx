/**
 * Setup's first step asks for the owner's mobile / WhatsApp number when none was given at sign-up — Google sign-ups
 * never see the sign-up form (website brief 3.3). Optional; saved with the salon (save_owner_contact).
 */
import { useQuery } from '@tanstack/react-query';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { PhoneField, type PhoneValue } from '@/features/auth/PhoneField';
import { supabase } from '@/lib/supabase';
import { CheckRow } from '@/ui';

export interface ContactValues {
  ownerPhone: PhoneValue;
  whatsappOk: boolean;
}

/** Whether this owner already gave a number (at sign-up). */
export function useHasContact(userId: string | undefined) {
  return useQuery({
    enabled: Boolean(userId),
    queryKey: ['owner-contact', userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('owner_contacts').select('phone').eq('user_id', userId!).maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
  });
}

export function SetupContact<T extends FieldValues & ContactValues>({ control }: { control: Control<T> }) {
  const { t } = useTranslation();
  return (
    <>
      <Controller
        control={control}
        name={'ownerPhone' as FieldPath<T>}
        render={({ field, fieldState }) => (
          <PhoneField
            value={field.value as PhoneValue}
            onChange={field.onChange}
            label={t('auth.phone.label')}
            hint={t('auth.phone.hint')}
            error={fieldState.error?.message ? t(fieldState.error.message as 'validation.mobile') : undefined}
            testID="field-ownerPhone"
          />
        )}
      />
      <Controller
        control={control}
        name={'whatsappOk' as FieldPath<T>}
        render={({ field }) => (
          <CheckRow label={t('auth.phone.whatsappOk')} value={Boolean(field.value)} onChange={field.onChange} testID="setup-whatsapp-ok" />
        )}
      />
    </>
  );
}
