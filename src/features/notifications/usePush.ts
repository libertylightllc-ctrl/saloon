/**
 * Phones: ask once for permission, register this phone's Expo push token for the person signed in, and open
 * the right screen when a push is tapped. The web has no push. Needs the EAS project id (app.json
 * extra.eas.projectId), which the store builds have; without it registration is skipped quietly.
 */
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

import { notificationHref } from './links';
import { rememberPushToken } from './pushToken';

export function usePush(businessId: string) {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === 'web' || !Device.isDevice) return;
    let cancelled = false;
    void (async () => {
      const Notifications = await import('expo-notifications');
      Notifications.setNotificationHandler({
        handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
      });
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      if (!projectId) return;
      let { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
      if (status !== 'granted' || cancelled) return;
      const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
      rememberPushToken(token);
      await supabase.rpc('register_push_token', { p_business: businessId, p_token: token, p_platform: Platform.OS });
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let remove: (() => void) | undefined;
    void import('expo-notifications').then((Notifications) => {
      const sub = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as Record<string, unknown>;
        router.push(
          notificationHref({
            type: String(data.type ?? ''),
            entity_type: (data.entity_type as string | null) ?? null,
            entity_id: (data.entity_id as string | null) ?? null,
            data,
          }),
        );
      });
      remove = () => sub.remove();
    });
    return () => remove?.();
  }, [router]);
}
