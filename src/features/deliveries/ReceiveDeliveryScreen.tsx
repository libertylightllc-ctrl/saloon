import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { useCatalog, type InventoryItem } from '@/features/catalog/api';
import { qtyText } from '@/features/inventory/labels';
import { useSuppliers } from '@/features/moneyout/api';
import { PhotoButtons, PickedPreview } from '@/features/moneyout/ReceiptPhoto';
import { uploadPhoto, type PickedPhoto } from '@/features/moneyout/receipts';
import { normalizeDigits } from '@/lib/money';
import { spacing } from '@/theme';
import { Button, Card, Chip, FormError, HeaderBand, IconButton, QueryState, Screen, SearchBar, Text, TextField, useToast } from '@/ui';

import { useReceiveDelivery } from './api';

interface Line {
  item: InventoryItem;
  packs: string;
  pack: string;
}

const num = (s: string) => Number(normalizeDigits(s.trim()).replace(',', '.'));
const positive = (s: string) => s.trim() !== '' && Number.isFinite(num(s)) && num(s) > 0;
const digits = (v: string) => v.replace(/[^0-9.,٠-٩۰-۹]/g, '');

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="bodyStrong">{title}</Text>
      {hint ? (
        <Text variant="small" color="textSecondary">
          {hint}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

/**
 * "Receive a delivery": who it came from, what arrived (packs and what one pack holds), a photo of the delivery note
 * (needed from the front desk) and a note. No prices: the owner, a manager or the accountant adds them later, and
 * only then does it go into stock.
 */
export function ReceiveDeliveryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { business, branch, role } = useWorkspace();
  const suppliers = useSuppliers(business.id, false);
  const catalog = useCatalog(business.id);
  const receive = useReceiveDelivery(business.id, branch.id);
  const [clientRef] = useState(() => Crypto.randomUUID());
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [typed, setTyped] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [search, setSearch] = useState('');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<unknown>(null);
  const photoNeeded = role === 'cashier';

  const update = (id: string, patch: Partial<Line>) => setLines(lines.map((l) => (l.item.id === id ? { ...l, ...patch } : l)));
  const ready =
    lines.length > 0 && lines.every((l) => positive(l.packs) && positive(l.pack)) && (!photoNeeded || photo !== null) && (typed === null || typed.trim().length > 0);

  const save = async () => {
    setUploadError(null);
    let notePath: string | null = null;
    if (photo) {
      setUploading(true);
      try {
        notePath = await uploadPhoto('receipts', `${business.id}/deliveries`, clientRef, photo);
      } catch (e) {
        setUploadError(e);
        setUploading(false);
        return;
      }
      setUploading(false);
    }
    receive.mutate(
      {
        supplier_id: typed === null ? supplierId : null,
        supplier_name: typed?.trim() || null,
        note: note.trim() || null,
        note_path: notePath,
        client_ref: clientRef,
        lines: lines.map((l) => ({ item_id: l.item.id, packs: num(l.packs), pack_size: num(l.pack) })),
      },
      {
        onSuccess: (r) => {
          toast(t('deliveries.saved', { number: r.number }));
          router.replace({ pathname: '/deliveries/[id]', params: { id: r.delivery_id } });
        },
      },
    );
  };

  return (
    <Screen
      header={<HeaderBand title={t('deliveries.receive')} subtitle={t('deliveries.receiveSub')} onBack />}
      footer={<Button label={t('deliveries.save')} onPress={() => void save()} disabled={!ready} loading={uploading || receive.isPending} testID="delivery-save" />}
    >
      <View style={styles.body}>
        <Section title={t('deliveries.from')}>
          <QueryState query={suppliers}>
            {(rows) => (
              <View style={styles.wrap}>
                {rows.map((s) => (
                  <Chip
                    key={s.id}
                    label={s.name}
                    selected={typed === null && supplierId === s.id}
                    onPress={() => {
                      setTyped(null);
                      setSupplierId(supplierId === s.id ? null : s.id);
                    }}
                    testID={`delivery-supplier-${s.name}`}
                  />
                ))}
                <Chip icon="plus" label={t('deliveries.otherSupplier')} selected={typed !== null} onPress={() => setTyped(typed === null ? '' : null)} testID="delivery-supplier-other" />
              </View>
            )}
          </QueryState>
          {typed !== null ? (
            <TextField label={t('deliveries.supplierName')} value={typed} onChangeText={setTyped} maxLength={80} testID="delivery-supplier-name" />
          ) : null}
        </Section>
        <Section title={t('deliveries.items')} hint={t('deliveries.itemsHint')}>
          {lines.map((l, i) => (
            <Card key={l.item.id} variant="outlined" padding={spacing.md} style={styles.card} testID={`delivery-line-${i}`}>
              <View style={styles.row}>
                <Text variant="bodyStrong" style={styles.flex} numberOfLines={1}>
                  {l.item.name}
                </Text>
                <IconButton icon="x" variant="plain" accessibilityLabel={t('purchases.removeLine')} onPress={() => setLines(lines.filter((x) => x.item.id !== l.item.id))} />
              </View>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <TextField label={t('purchases.qtyPacks')} value={l.packs} onChangeText={(v) => update(l.item.id, { packs: digits(v) })} keyboardType="decimal-pad" testID={`delivery-line-packs-${i}`} />
                </View>
                <View style={styles.flex}>
                  <TextField
                    label={t('purchases.packHolds', { unit: t(`units.${l.item.unit as 'pcs'}`) })}
                    value={l.pack}
                    onChangeText={(v) => update(l.item.id, { pack: digits(v) })}
                    keyboardType="decimal-pad"
                    testID={`delivery-line-pack-${i}`}
                  />
                </View>
              </View>
              {positive(l.packs) && positive(l.pack) ? (
                <Text variant="small" color="textSecondary">
                  {t('deliveries.willAdd', { qty: qtyText(num(l.packs) * num(l.pack), l.item.unit, t) })}
                </Text>
              ) : null}
            </Card>
          ))}
          <QueryState query={catalog}>
            {(data) => {
              const left = data.items.filter((i) => !lines.some((l) => l.item.id === i.id));
              const q = search.trim().toLowerCase();
              const shown = q ? left.filter((i) => i.name.toLowerCase().includes(q)) : left;
              return left.length === 0 ? null : (
                <View style={styles.section}>
                  {left.length > 12 ? <SearchBar value={search} onChangeText={setSearch} placeholder={t('inventory.search')} testID="delivery-item-search" /> : null}
                  <View style={styles.wrap}>
                    {shown.slice(0, 30).map((item) => (
                      <Chip
                        key={item.id}
                        icon="package"
                        label={item.name}
                        onPress={() => {
                          setLines([...lines, { item, packs: '', pack: String(Number(item.pack_size ?? 1)) }]);
                          setSearch('');
                        }}
                        testID={`delivery-item-${item.name}`}
                      />
                    ))}
                  </View>
                </View>
              );
            }}
          </QueryState>
        </Section>
        <Section title={t('deliveries.notePhoto')} hint={t(photoNeeded ? 'deliveries.notePhotoNeeded' : 'deliveries.notePhotoHint')}>
          {photo ? <PickedPreview photo={photo} onRemove={() => setPhoto(null)} /> : <PhotoButtons onPicked={setPhoto} />}
        </Section>
        <TextField label={t('deliveries.note')} value={note} onChangeText={setNote} maxLength={500} multiline testID="delivery-note" />
        <Text variant="small" color="textSecondary">
          {t('deliveries.afterSave')}
        </Text>
        <FormError error={uploadError ?? receive.error} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xl },
  section: { gap: spacing.sm },
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
