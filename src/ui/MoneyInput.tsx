import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { numericFontFamily } from '@/lib/fonts';
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
  testID?: string;
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
  testID,
}: MoneyInputProps) {
  const { t } = useTranslation();
  const [text, setText] = useState(() => toText(value, currency));
  const invalid = text.trim() !== '' && parseMoney(text, currency) === null;
  // Follow a value set from outside (a VAT worked out from the price, a total that changed), but never while the person
  // is typing here: inside a sheet the parent's copy of each keystroke arrives a render or more later, and taking such
  // a late, older value for a change rewrote "1" as "1.00", so the next digit made "1.000" (owner report: a tip could
  // not be 10). Out of the box, the text follows the value whenever the value changes.
  const [focused, setFocused] = useState(false);
  const [prop, setProp] = useState(value);
  if (value !== prop) {
    setProp(value);
    if (!focused && value !== (text.trim() === '' ? null : parseMoney(text, currency))) setText(toText(value, currency));
  }

  return (
    <TextField
      label={label}
      testID={testID}
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
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        const parsed = parseMoney(text, currency);
        if (parsed !== null) setText(toText(parsed, currency));
      }}
      style={{ fontFamily: numericFontFamily('medium') }}
    />
  );
}
