import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { businessDate } from '@/lib/dates';
import { fileSlug, shareZip } from '@/lib/exportFile';
import { supabase } from '@/lib/supabase';
import { spacing, useTheme } from '@/theme';
import { Button, Card, FormError, HeaderBand, Icon, Screen, Text, useToast } from '@/ui';

import { backupFiles } from './backup';

/** Backup & recovery: the whole salon as a ZIP of CSV files the owner keeps somewhere safe. */
export function BackupScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const toast = useToast();
  const { business } = useWorkspace();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const backup = useMutation({
    mutationFn: async () => {
      const { data: branches, error } = await supabase.from('branches').select('id').eq('business_id', business.id).order('created_at');
      if (error) throw error;
      const files = await backupFiles(business.id, (branches ?? []).map((b) => b.id), (done, total) => setProgress({ done, total }));
      await shareZip(`${fileSlug(business.name)}-backup-${businessDate(new Date(), business.timezone)}`, files, t('backup.title'));
      return Object.keys(files).length;
    },
    onSuccess: (count) => toast(t('backup.done', { count })),
    onSettled: () => setProgress(null),
  });

  return (
    <Screen header={<HeaderBand title={t('backup.title')} subtitle={t('backup.subtitle')} onBack />}>
      <View style={styles.body}>
        <Card variant="outlined" style={styles.card}>
          <View style={[styles.icon, { backgroundColor: theme.colors.primary50 }]}>
            <Icon name="archive" size={22} color={theme.colors.primary500} />
          </View>
          <Text variant="h4">{t('backup.what')}</Text>
          <Text color="textSecondary">{t('backup.body')}</Text>
          <Text variant="small" color="textSecondary">
            {t('backup.keepSafe')}
          </Text>
          <FormError error={backup.error} />
          <Button
            label={progress ? t('backup.progress', { done: progress.done, total: progress.total }) : t('backup.download')}
            icon="download"
            loading={backup.isPending}
            onPress={() => backup.mutate()}
            testID="backup-download"
          />
        </Card>
        <Text variant="small" color="textSecondary">
          {t('backup.recovery')}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  card: { gap: spacing.md },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
