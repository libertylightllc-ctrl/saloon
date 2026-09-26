import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
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
  QueryState,
  Screen,
  SegmentTabs,
  Text,
  TextField,
  useToast,
} from '@/ui';

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

  const [amount, setAmount] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [method, setMethod] = useState<PayMethod>('cash');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [clientRef] = useState(() => Crypto.randomUUID());
  const [newCategory, setNewCategory] = useState<string | null>(null);

  const ready = Boolean(amount && amount > 0 && categoryId);
  const save = () =>
    record.mutate(
      { category_id: categoryId!, amount_minor: amount!, method, business_date: date, note: note.trim() || null, client_ref: clientRef },
      {
        onSuccess: () => {
          toast(t('expenses.saved'));
          router.back();
        },
      },
    );

  return (
    <>
      <Screen
        header={<HeaderBand title={t('expenses.newTitle')} onBack />}
        footer={<Button label={t('expenses.save')} onPress={save} disabled={!ready} loading={record.isPending} testID="expense-save" />}
      >
        <View style={styles.body}>
          <MoneyInput label={t('expenses.amount')} value={amount} onChange={setAmount} testID="expense-amount" />
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
  body: { gap: spacing.xl },
  section: { gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
