import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { MoneyInput } from '../MoneyInput';

export function FormMoneyField<T extends FieldValues>({
  control,
  name,
  label,
  hint,
}: {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  hint?: string;
}) {
  const { t } = useTranslation();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <MoneyInput
          label={label}
          hint={hint}
          value={field.value ?? null}
          onChange={field.onChange}
          error={fieldState.error?.message ? t(fieldState.error.message as 'validation.required') : undefined}
          testID={`field-${String(name)}`}
        />
      )}
    />
  );
}
