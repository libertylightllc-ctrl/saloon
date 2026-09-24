import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  DEFAULT_CURRENCY,
  formatAmount,
  parseMoney,
  type CurrencyCode,
  type Minor,
} from '@/lib/money';

import { Text } from './Text';
import { TextField } from './TextField';

export interface MoneyInputProps {
  label?: string;
  /** Minor units (fils), or null when empty/invalid. */
  value: Minor | null;
  onChange: (value: Minor | null) => void;
  currency?: CurrencyCode;
  error?: string;
  hint?: string;
  placeholder?: string;
}

const toText = (value: Minor | null, currency: CurrencyCode) =>
  value === null ? '' : formatAmount(value, currency, { grouping: false });

/** Currency prefix, numeric keypad; what people type is parsed straight to minor units. */
export function MoneyInput({
  label,
  value,
  onChange,
  currency = DEFAULT_CURRENCY,
  error,
  hint,
  placeholder,
}: MoneyInputProps) {
  const { t } = useTranslation();
  const [text, setText] = useState(() => toText(value, currency));
  const invalid = text.trim() !== '' && parseMoney(text, currency) === null;

  return (
    <TextField
      label={label}
      value={text}
      placeholder={placeholder ?? formatAmount(0, currency)}
      keyboardType="decimal-pad"
      inputMode="decimal"
      error={error ?? (invalid ? t('common.invalidAmount') : undefined)}
      hint={hint}
      start={
        <Text variant="bodyStrong" color="textSecondary">
          {currency}
        </Text>
      }
      onChangeText={(next) => {
        setText(next);
        onChange(next.trim() === '' ? null : parseMoney(next, currency));
      }}
      onBlur={() => {
        const parsed = parseMoney(text, currency);
        if (parsed !== null) setText(toText(parsed, currency));
      }}
      style={{ fontVariant: ['tabular-nums'] }}
    />
  );
}
