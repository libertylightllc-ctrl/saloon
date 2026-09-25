import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { TextInputProps } from 'react-native';

import { TextField } from '../TextField';

export interface FormTextFieldProps<T extends FieldValues> extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  hint?: string;
}

/** A TextField bound to react-hook-form; zod messages are i18n keys ("validation.required"). */
export function FormTextField<T extends FieldValues>({ control, name, label, hint, ...input }: FormTextFieldProps<T>) {
  const { t } = useTranslation();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          label={label}
          hint={hint}
          value={field.value ?? ''}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          error={fieldState.error?.message ? t(fieldState.error.message as 'validation.required') : undefined}
          testID={`field-${String(name)}`}
          {...input}
        />
      )}
    />
  );
}
