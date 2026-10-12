import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { spacing, useTheme } from '@/theme';
import { Button, Icon, Text } from '@/ui';

import { FAQ_IDS, matchFaq, type FaqId, type FaqItem } from './questions';

const FIRST = 6;

/**
 * Common questions with their answers. `browse`: list them when nothing is typed yet (a new conversation); otherwise
 * only the ones that match what is being typed show up, just above the message box.
 */
export function CommonQuestions({ query, browse }: { query: string; browse: boolean }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const [open, setOpen] = useState<FaqId | null>(null);
  const [all, setAll] = useState(false);
  const items = useMemo<FaqItem[]>(
    () => FAQ_IDS.map((id) => ({ id, q: t(`support.faq.${id}.q`), a: t(`support.faq.${id}.a`) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language],
  );
  const typed = query.trim().length >= 3;
  const matches = typed ? matchFaq(query, items) : [];
  const shown = matches.length
    ? matches
    : browse && !typed
      ? all
        ? items
        : items.slice(0, FIRST)
      : [];
  if (!shown.length) return null;
  return (
    <View style={styles.box} testID="faq">
      <Text variant="bodyStrong">
        {matches.length ? t('support.faqMatches') : t('support.faqTitle')}
      </Text>
      {shown.map((it) => {
        const isOpen = open === it.id;
        return (
          <Pressable
            key={it.id}
            onPress={() => setOpen(isOpen ? null : it.id)}
            accessibilityRole="button"
            aria-expanded={isOpen}
            style={[
              styles.item,
              {
                borderColor: theme.colors.divider,
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.surface,
              },
            ]}
            testID={`faq-${it.id}`}
          >
            <View style={styles.row}>
              <Text variant="bodyStrong" style={styles.flex}>
                {it.q}
              </Text>
              <Icon
                name={isOpen ? 'chevronDown' : 'chevronRight'}
                size={18}
                color={theme.colors.textSecondary}
              />
            </View>
            {isOpen ? (
              <Text color="textSecondary" selectable testID={`faq-${it.id}-answer`}>
                {it.a}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
      {browse && !matches.length && !all && items.length > FIRST ? (
        <Button
          label={t('support.faqAll')}
          variant="ghost"
          size="sm"
          onPress={() => setAll(true)}
          testID="faq-all"
        />
      ) : null}
      <Text variant="small" color="textSecondary">
        {t('support.faqNotAnswered')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.sm },
  item: { borderWidth: 1, padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
