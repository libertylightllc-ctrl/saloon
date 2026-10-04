import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { isUae } from '@/lib/countries';
import { isBusinessDate } from '@/lib/dates';
import { normalizeDigits } from '@/lib/money';
import { spacing } from '@/theme';
import { Button, Chip, FormError, HeaderBand, MoneyInput, QueryState, Screen, SegmentTabs, SwitchRow, Text, TextField, useToast } from '@/ui';

import { useInventory, useItemPackSize, useSaveItem, type ItemKind, type ItemUnit, type StockItem } from './api';

const KINDS: ItemKind[] = ['consumable', 'retail', 'tool'];
const UNITS: ItemUnit[] = ['pcs', 'ml', 'g', 'pairs'];

/** Add or edit an item (owner). Tools get condition, next service date and who it is assigned to. */
export function ItemFormScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { business, branch } = useWorkspace();
  const items = useInventory(branch.id);
  const pack = useItemPackSize(business.id, id);
  return (
    <Screen header={<HeaderBand title={t(id ? 'inventory.editTitle' : 'inventory.newTitle')} onBack />}>
      {id ? (
        <QueryState query={items}>
          {(rows) => (
            <QueryState query={pack}>{(packSize) => <ItemForm item={rows.find((i) => i.item_id === id) ?? null} packSize={packSize} />}</QueryState>
          )}
        </QueryState>
      ) : (
        <ItemForm item={null} packSize={1} />
      )}
    </Screen>
  );
}

function ItemForm({ item, packSize }: { item: StockItem | null; packSize: number }) {
  const { t } = useTranslation();
  const toast = useToast();
  const router = useRouter();
  const { business, branch } = useWorkspace();
  const save = useSaveItem(branch.id, business.id);
  const [name, setName] = useState(item?.name ?? '');
  const [kind, setKind] = useState<ItemKind>(item?.kind ?? 'consumable');
  const [unit, setUnit] = useState<ItemUnit>(item?.unit ?? 'pcs');
  const [reorder, setReorder] = useState(item ? String(item.reorder_level) : '');
  const [price, setPrice] = useState<number | null>(item?.sell_price_minor ?? null);
  const [location, setLocation] = useState(item?.location ?? '');
  const [condition, setCondition] = useState<'good' | 'needs_service'>(item?.condition ?? 'good');
  const [serviceDate, setServiceDate] = useState(item?.next_service_date ?? '');
  const [assigned, setAssigned] = useState(item?.assigned_to ?? '');
  const [montaji, setMontaji] = useState(item?.montaji_reg_no ?? '');
  const [active, setActive] = useState(item?.active ?? true);
  const [pack, setPack] = useState(String(packSize));

  const reorderN = reorder.trim() === '' ? 0 : Number(normalizeDigits(reorder).replace(',', '.'));
  const reorderOk = Number.isFinite(reorderN) && reorderN >= 0;
  const dateOk = serviceDate.trim() === '' || isBusinessDate(serviceDate.trim());
  const priceOk = kind !== 'retail' || (price !== null && price >= 0);
  const packN = pack.trim() === '' ? 1 : Number(normalizeDigits(pack).replace(',', '.'));
  const packOk = Number.isFinite(packN) && packN > 0;
  const ok = name.trim().length > 0 && reorderOk && dateOk && priceOk && packOk;

  return (
    <View style={styles.body}>
      <TextField label={t('inventory.fields.name')} value={name} onChangeText={setName} maxLength={60} testID="item-name" />
      <Text variant="bodyStrong">{t('inventory.fields.kind')}</Text>
      <SegmentTabs<ItemKind> items={KINDS.map((k) => ({ key: k, label: t(`inventory.kinds.${k}`) }))} value={kind} onChange={setKind} testID="item-kind" />
      <Text variant="bodyStrong">{t('inventory.fields.unit')}</Text>
      <View style={styles.chips}>
        {UNITS.map((u) => (
          <Chip key={u} label={t(`inventory.units.${u}`)} selected={unit === u} onPress={() => setUnit(u)} testID={`item-unit-${u}`} />
        ))}
      </View>
      {kind !== 'tool' ? (
        <TextField
          label={t('inventory.fields.reorder')}
          hint={t('inventory.fields.reorderHint')}
          value={reorder}
          onChangeText={setReorder}
          keyboardType="decimal-pad"
          error={reorderOk ? undefined : t('validation.range')}
          testID="item-reorder"
        />
      ) : null}
      {kind !== 'tool' ? (
        <TextField
          label={t('inventory.fields.packSize', { unit: t(`inventory.units.${unit}`) })}
          hint={t('inventory.fields.packSizeHint')}
          value={pack}
          onChangeText={setPack}
          keyboardType="decimal-pad"
          error={packOk ? undefined : t('validation.range')}
          testID="item-pack"
        />
      ) : null}
      {kind === 'retail' ? (
        <MoneyInput label={t('inventory.fields.price')} value={price} onChange={setPrice} testID="item-price" />
      ) : null}
      <TextField label={t('inventory.fields.location')} placeholder={t('inventory.fields.locationHint')} value={location} onChangeText={setLocation} maxLength={40} testID="item-location" />
      {kind === 'tool' ? (
        <>
          <Text variant="bodyStrong">{t('inventory.condition')}</Text>
          <SegmentTabs<'good' | 'needs_service'>
            items={[
              { key: 'good', label: t('inventory.conditions.good') },
              { key: 'needs_service', label: t('inventory.conditions.needs_service') },
            ]}
            value={condition}
            onChange={setCondition}
            testID="item-condition"
          />
          <TextField
            label={t('inventory.nextService')}
            placeholder="2026-10-31"
            value={serviceDate}
            onChangeText={setServiceDate}
            error={dateOk ? undefined : t('inventory.fields.dateFormat')}
            testID="item-service-date"
          />
          <TextField label={t('inventory.assigned')} placeholder={t('inventory.fields.assignedHint')} value={assigned} onChangeText={setAssigned} maxLength={60} testID="item-assigned" />
        </>
      ) : null}
      {kind !== 'tool' && isUae(business.country_code) ? (
        <TextField label={t('inventory.fields.montaji')} hint={t('inventory.fields.montajiHint')} value={montaji} onChangeText={setMontaji} maxLength={40} testID="item-montaji" />
      ) : null}
      {item ? <SwitchRow label={t('inventory.fields.active')} hint={t('inventory.fields.activeHint')} value={active} onChange={setActive} testID="item-active" /> : null}
      <FormError error={save.error} />
      <Button
        label={t('common.save')}
        disabled={!ok}
        loading={save.isPending}
        onPress={() =>
          save.mutate(
            {
              id: item?.item_id,
              name: name.trim(),
              kind,
              unit,
              reorder_level: kind === 'tool' ? 0 : reorderN,
              sell_price_minor: kind === 'retail' ? price : null,
              location: location.trim() || null,
              condition: kind === 'tool' ? condition : null,
              next_service_date: kind === 'tool' && serviceDate.trim() ? serviceDate.trim() : null,
              assigned_to: kind === 'tool' ? assigned.trim() || null : null,
              montaji_reg_no: kind === 'tool' ? null : montaji.trim() || null,
              pack_size: kind === 'tool' ? 1 : packN,
              active,
            },
            {
              onSuccess: (id) => {
                toast(t('inventory.saved'));
                // Editing goes back to the item it came from; a new item opens its page.
                if (item) router.back();
                else router.replace({ pathname: '/inventory/[id]', params: { id } });
              },
            },
          )
        }
        testID="item-save"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
