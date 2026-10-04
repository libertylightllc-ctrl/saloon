import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { vatFromInclusive } from '@/lib/money';
import { businessDate, shiftBusinessDate } from '@/lib/dates';
import { can } from '@/lib/permissions';
import { spacing } from '@/theme';
import {
  BottomSheet,
  Button,
  Chip,
  DateStrip,
  FormError,
  HeaderBand,
  MoneyInput,
  SwitchRow,
  QueryState,
  Screen,
  SegmentTabs,
  Text,
  TextField,
  useToast,
} from '@/ui';

import { PhotoButtons, PickedPreview } from './ReceiptPhoto';
import { useAttachReceipt, type PickedPhoto } from './receipts';
import { useExpenseCategories, useRecordExpense, useSaveExpenseCategory, type PayMethod } from './api';
import { categoryIcon, useCategoryName } from './labels';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="bodyStrong">{title}</Text>
      {children}
    </View>
  );
}

/** Record money spent that is not stock: tea & food, electricity, water, internet, uniforms, dry cleaning… */
export function ExpenseFormScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const name = useCategoryName();
  const { business, branch, role } = useWorkspace();
  const owner = can(role, 'payOrReverseMoneyOut');
  const today = businessDate(new Date(), business.timezone);
  const categories = useExpenseCategories(business.id);
  const record = useRecordExpense(business.id, branch.id);
  const saveCategory = useSaveExpenseCategory(business.id);
  const attach = useAttachReceipt('expense', business.id);
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);

  const [amount, setAmount] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [method, setMethod] = useState<PayMethod>('cash');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [clientRef] = useState(() => Crypto.randomUUID());
  const [newCategory, setNewCategory] = useState<string | null>(null);

  // Tax inside what was paid (5/105 of it for 5% VAT), from a tax invoice; only for a tax-registered salon; editable.
  const vatRegistered = branch.vat_mode === 'on';
  const [withVat, setWithVat] = useState(false);
  const [vatEdited, setVatEdited] = useState<number | null>(null);
  const vat = vatRegistered && withVat && amount ? (vatEdited ?? vatFromInclusive(amount, branch.tax_rate_bps)) : 0;
  const ready = Boolean(amount && amount > 0 && categoryId) && vat < (amount ?? 0);
  const save = () =>
    record.mutate(
      { category_id: categoryId!, amount_minor: amount!, vat_minor: vat, method, business_date: date, note: note.trim() || null, client_ref: clientRef },
      {
        // The photo goes up once the expense exists; if it fails the expense stays and the photo can be added later.
        onSuccess: async (r) => {
          if (photo) {
            try {
              await attach.mutateAsync({ rowId: r.expense_id, photo });
            } catch {
              toast(t('receipts.failedLater'));
              router.back();
              return;
            }
          }
          toast(t('expenses.saved'));
          router.back();
        },
      },
    );

  return (
    <>
      <Screen
        header={<HeaderBand title={t('expenses.newTitle')} onBack />}
        footer={<Button label={t('expenses.save')} onPress={save} disabled={!ready} loading={record.isPending || attach.isPending} testID="expense-save" />}
      >
        <View style={styles.body}>
          <MoneyInput label={t('expenses.amount')} value={amount} onChange={setAmount} testID="expense-amount" />
          {vatRegistered ? (
            <View style={styles.vat}>
              <SwitchRow label={t('expenses.withVat')} hint={t('expenses.withVatHint')} value={withVat} onChange={setWithVat} testID="expense-with-vat" />
              {withVat ? <MoneyInput label={t('expenses.vatAmount')} value={vat} onChange={setVatEdited} testID="expense-vat" /> : null}
            </View>
          ) : null}
          <Section title={t('expenses.category')}>
            <QueryState query={categories}>
              {(rows) => (
                <View style={styles.wrap}>
                  {rows.map((c) => (
                    <Chip
                      key={c.id}
                      icon={categoryIcon(c.icon)}
                      label={name(c)}
                      selected={categoryId === c.id}
                      onPress={() => setCategoryId(c.id)}
                      testID={`expense-category-${c.key ?? c.name}`}
                    />
                  ))}
                  {owner ? <Chip icon="plus" label={t('expenses.newCategory')} onPress={() => setNewCategory('')} testID="expense-category-new" /> : null}
                </View>
              )}
            </QueryState>
          </Section>
          <Section title={t('expenses.paidBy')}>
            {owner ? (
              <SegmentTabs<PayMethod>
                items={(['cash', 'card', 'bank'] as const).map((m) => ({ key: m, label: t(`expenses.methods.${m}`) }))}
                value={method}
                onChange={setMethod}
                testID="expense-method"
              />
            ) : (
              <Text color="textSecondary">{t('expenses.cashOnly')}</Text>
            )}
            <Text variant="small" color="textSecondary">
              {t(method === 'cash' ? 'expenses.cashHint' : 'expenses.bankHint')}
            </Text>
          </Section>
          {owner ? (
            <Section title={t('expenses.date')}>
              <DateStrip dates={Array.from({ length: 14 }, (_, i) => shiftBusinessDate(today, i - 13))} value={date} onChange={setDate} />
            </Section>
          ) : null}
          <TextField label={t('expenses.note')} hint={t('expenses.noteHint')} value={note} onChangeText={setNote} maxLength={200} testID="expense-note" />
          <Section title={t('receipts.photo')}>
            {photo ? <PickedPreview photo={photo} onRemove={() => setPhoto(null)} /> : <PhotoButtons onPicked={setPhoto} />}
          </Section>
          <FormError error={record.error} />
        </View>
      </Screen>
      <BottomSheet open={newCategory !== null} onClose={() => setNewCategory(null)} title={t('expenses.newCategory')}>
        <TextField label={t('expenses.categoryName')} value={newCategory ?? ''} onChangeText={setNewCategory} maxLength={40} testID="expense-category-name" />
        <FormError error={saveCategory.error} />
        <Button
          label={t('common.save')}
          disabled={!newCategory?.trim()}
          loading={saveCategory.isPending}
          onPress={() =>
            saveCategory.mutate(
              { name: newCategory!.trim() },
              {
                onSuccess: (id) => {
                  setCategoryId(id);
                  setNewCategory(null);
                },
              },
            )
          }
          testID="expense-category-save"
        />
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  vat: { gap: spacing.sm },
  body: { gap: spacing.xl },
  section: { gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
