import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';

import { Chip } from '../Chip';
import { Text } from '../Text';

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/** The days a branch is open, as weekday numbers (0 = Sunday), bound to react-hook-form. */
export function FormDaysField<T extends FieldValues>({
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
      render={({ field, fieldState }) => {
        const days = (field.value ?? []) as number[];
        return (
          <View style={styles.field}>
            <Text variant="bodyStrong">{label}</Text>
            {hint ? (
              <Text variant="small" color="textSecondary">
                {hint}
              </Text>
            ) : null}
            <View style={styles.wrap}>
              {DAYS.map((day, i) => {
                const on = days.includes(i);
                return (
                  <Chip
                    key={day}
                    label={t(`common.days.${day}`)}
                    selected={on}
                    onPress={() =>
                      field.onChange(
                        on ? days.filter((d) => d !== i) : [...days, i].sort((a, b) => a - b),
                      )
                    }
                    testID={`open-day-${day}`}
                  />
                );
              })}
            </View>
            {fieldState.error?.message ? (
              <Text variant="small" color="primaryText">
                {t(fieldState.error.message as 'validation.days')}
              </Text>
            ) : null}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
