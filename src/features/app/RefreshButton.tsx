import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

import { IconButton, useToast } from '@/ui';

/**
 * Refresh the app (owner, 2026-10-05: "there should be refresh button for app"). On the web — including the app saved
 * to a phone's home screen, which has no browser reload — it reloads the page: the newest version of the app and fresh
 * data. In the phone app it reads everything again from the server.
 */
export function useRefreshApp() {
  const client = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const refresh = () => {
    if (Platform.OS === 'web') {
      window.location.reload();
      return;
    }
    if (busy) return;
    setBusy(true);
    void client
      .invalidateQueries()
      .then(() => toast(t('app.refreshed')))
      .finally(() => setBusy(false));
  };
  return { refresh, busy };
}

export function RefreshButton({ variant }: { variant: 'surface' | 'plain' }) {
  const { t } = useTranslation();
  const { refresh } = useRefreshApp();
  return <IconButton icon="rotate" variant={variant} accessibilityLabel={t('app.refresh')} onPress={refresh} testID="app-refresh" />;
}
