import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ApprovalPanel } from '@/features/approvals/ApprovalSheet';
import { isApprovalNeeded } from '@/features/approvals/api';
import { useWorkspace } from '@/features/auth/session';
import { useControls } from '@/features/controls/api';
import { formatMoney, vatFromInclusive } from '@/lib/money';
import { businessDate, shiftBusinessDate } from '@/lib/dates';
import { can, levelOf } from '@/lib/permissions';
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
import { uploadPhoto, type PickedPhoto } from './receipts';
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

/**
 * Record money spent that is not stock: tea & food, electricity, water, internet, uniforms, dry cleaning… Cash comes
 * from the drawer (petty cash); card and bank do not. The front desk pays only petty cash, today, always with a receipt
 * photo, and above the branch's limit with a manager's or the owner's PIN (asked after the server has checked the
 * drawer, so a PIN is not used on cash that is not there). The accountant pays by card or bank only.
 */
export function ExpenseFormScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const name = useCategoryName();
  const { business, branch, role } = useWorkspace();
  const owner = can(role, 'payOrReverseMoneyOut');
  const petty = levelOf(role, 'pettyCash') === 'limit';
  const methods: PayMethod[] = [...(can(role, 'pettyCash') ? ['cash' as const] : []), ...(can(role, 'addExpense') ? (['card', 'bank'] as const) : [])];
  const today = businessDate(new Date(), business.timezone);
  const categories = useExpenseCategories(business.id);
  const record = useRecordExpense(business.id, branch.id);
  const saveCategory = useSaveExpenseCategory(business.id);
  const controls = useControls(branch.id);
  const limit = controls.data?.petty_cash_limit_minor ?? null;
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  // The photo goes up before the expense is saved; kept so a retry (or the PIN step) does not upload it again.
  const [receiptPath, setReceiptPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<unknown>(null);
  const [asking, setAsking] = useState(false);

  const [amount, setAmount] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [method, setMethod] = useState<PayMethod>(methods[0] ?? 'cash');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [clientRef] = useState(() => Crypto.randomUUID());
  const [newCategory, setNewCategory] = useState<string | null>(null);

  // Tax inside what was paid (5/105 of it for 5% VAT), from a tax invoice; only for a tax-registered salon; editable.
  const vatRegistered = branch.vat_mode === 'on';
  const [withVat, setWithVat] = useState(false);
  const [vatEdited, setVatEdited] = useState<number | null>(null);
  const vat = vatRegistered && withVat && amount ? (vatEdited ?? vatFromInclusive(amount, branch.tax_rate_bps)) : 0;
  const ready = Boolean(amount && amount > 0 && categoryId) && vat < (amount ?? 0) && (!petty || photo !== null);
  const pickPhoto = (picked: PickedPhoto | null) => {
    setPhoto(picked);
    setReceiptPath(null);
  };
  const save = async (approvalId?: string) => {
    let path = receiptPath;
    if (photo && !path) {
      setUploading(true);
      setUploadError(null);
      try {
        path = await uploadPhoto('receipts', `${business.id}/expenses`, clientRef, photo);
        setReceiptPath(path);
      } catch (e) {
        setUploadError(e);
        return;
      } finally {
        setUploading(false);
      }
    }
    record.mutate(
      {
        category_id: categoryId!,
        amount_minor: amount!,
        vat_minor: vat,
        method,
        business_date: petty ? today : date,
        note: note.trim() || null,
        client_ref: clientRef,
        receipt_path: path,
        approval_id: approvalId,
      },
      {
        onSuccess: () => {
          toast(t('expenses.saved'));
          router.back();
        },
        onError: (e) => {
          if (isApprovalNeeded(e)) setAsking(true);
        },
      },
    );
  };

  return (
    <>
      <Screen
        header={<HeaderBand title={t(petty ? 'expenses.pettyTitle' : 'expenses.newTitle')} onBack />}
        footer={
          asking ? (
            <ApprovalPanel
              request={{
                action: 'petty_cash',
                amount: amount ?? 0,
                summary: t('approval.pettyCash', { amount: formatMoney(amount ?? 0) }),
              }}
              onApproved={(a) => {
                setAsking(false);
                void save(a.id);
              }}
              onBack={() => setAsking(false)}
            />
          ) : (
            // The error sits by Save, which stays pinned, so "not enough cash in the drawer" is seen without scrolling.
            <View style={styles.footer}>
              <FormError error={uploadError ?? record.error} />
              <Button
                label={t('expenses.save')}
                onPress={() => void save()}
                disabled={!ready}
                loading={record.isPending || uploading}
                testID="expense-save"
              />
            </View>
          )
        }
      >
        <View style={styles.body}>
          <MoneyInput
            label={t('expenses.amount')}
            hint={petty && limit !== null ? t('expenses.pinAbove', { amount: formatMoney(limit) }) : undefined}
            value={amount}
            onChange={setAmount}
            testID="expense-amount"
          />
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
            {methods.length > 1 ? (
              <SegmentTabs<PayMethod>
                items={methods.map((m) => ({ key: m, label: t(`expenses.methods.${m}`) }))}
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
          {!petty ? (
            <Section title={t('expenses.date')}>
              <DateStrip dates={Array.from({ length: 14 }, (_, i) => shiftBusinessDate(today, i - 13))} value={date} onChange={setDate} />
            </Section>
          ) : null}
          <TextField label={t('expenses.note')} hint={t('expenses.noteHint')} value={note} onChangeText={setNote} maxLength={200} testID="expense-note" />
          <Section title={t(petty ? 'receipts.photoNeeded' : 'receipts.photo')}>
            {photo ? <PickedPreview photo={photo} onRemove={() => pickPhoto(null)} /> : <PhotoButtons onPicked={pickPhoto} />}
          </Section>
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
  footer: { gap: spacing.sm },
});
