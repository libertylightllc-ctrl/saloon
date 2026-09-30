import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { semantic, spacing, useTheme } from '@/theme';

import { IconButton } from './IconButton';
import { START_ALIGN, Text, useFontFamily } from './Text';

export interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  /** Content at the start edge inside the field (icon, currency). */
  start?: ReactNode;
  end?: ReactNode;
}

/**
 * Label above, 48 high, focus ring in primary400, error text below. A secret field (password, PIN) gets an eye
 * button that shows or hides what was typed.
 */
export function TextField({
  label,
  error,
  hint,
  start,
  end,
  onFocus,
  onBlur,
  style,
  secureTextEntry,
  testID,
  ...input
}: TextFieldProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const font = useFontFamily();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const borderColor = error
    ? semantic.error.main
    : focused
      ? theme.colors.primary400
      : theme.colors.border;

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text variant="bodyStrong" color="text">
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.field,
          {
            borderColor,
            borderWidth: focused || error ? 1.5 : 1,
            borderRadius: theme.radius.md,
            backgroundColor:
              input.editable === false ? theme.colors.inputFill : theme.colors.surface,
          },
        ]}
      >
        {start}
        <TextInput
          placeholderTextColor={theme.colors.textDisabled}
          selectionColor={theme.colors.primary500}
          accessibilityLabel={label}
          style={[
            styles.input,
            { fontFamily: font('regular'), color: theme.colors.text, textAlign: START_ALIGN },
            style,
          ]}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          secureTextEntry={secureTextEntry && !revealed}
          testID={testID}
          {...input}
        />
        {secureTextEntry ? (
          <IconButton
            icon={revealed ? 'eyeOff' : 'eye'}
            variant="plain"
            size={32}
            accessibilityLabel={t(revealed ? 'common.hidePassword' : 'common.showPassword')}
            onPress={() => setRevealed(!revealed)}
            testID={testID ? `${testID}-reveal` : undefined}
          />
        ) : null}
        {end}
      </View>
      {error ? (
        <Text
          variant="small"
          style={{ color: semantic.error.hover }}
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      ) : hint ? (
        <Text variant="small" color="textSecondary">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  field: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  input: { flex: 1, fontSize: 14, paddingVertical: spacing.md },
});
