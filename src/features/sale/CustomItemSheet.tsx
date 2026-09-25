import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Minor } from '@/lib/money';
import { BottomSheet, Button, MoneyInput, TextField } from '@/ui';

/** A one-off line: name + price (e.g. "Hot towel add-on"). */
export function CustomItemSheet({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string, priceMinor: Minor) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [price, setPrice] = useState<Minor | null>(null);
  const valid = name.trim().length > 0 && price !== null && price >= 0;
  return (
    <BottomSheet open={open} onClose={onClose} title={t('sale.customItem')}>
      <TextField label={t('sale.customName')} value={name} onChangeText={setName} testID="custom-name" />
      <MoneyInput label={t('sale.customPrice')} value={price} onChange={setPrice} testID="custom-price" />
      <Button
        label={t('sale.addToBasket')}
        disabled={!valid}
        onPress={() => {
          onAdd(name.trim(), price ?? 0);
          setName('');
          setPrice(null);
          onClose();
        }}
        testID="custom-add"
      />
    </BottomSheet>
  );
}
