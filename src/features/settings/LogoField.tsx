import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { spacing, useTheme } from '@/theme';
import { Button, FormError, Icon, Text, useToast } from '@/ui';

import { logoUrl, pickLogo, useSetLogo } from './logo';

/** Branch settings: the logo at the top of every receipt — add, change or remove (saved at once, not with Save). */
export function LogoField() {
  const { t } = useTranslation();
  const theme = useTheme();
  const toast = useToast();
  const { business, branch } = useWorkspace();
  const setLogo = useSetLogo(business.id, branch.id);
  const [pickError, setPickError] = useState<unknown>(null);
  const [picking, setPicking] = useState(false);

  const add = () => {
    setPickError(null);
    setPicking(true);
    pickLogo()
      .then((photo) => photo && setLogo.mutate(photo, { onSuccess: () => toast(t('branch.logo.saved')) }))
      .catch(setPickError)
      .finally(() => setPicking(false));
  };

  return (
    <View style={styles.block} testID="logo-field">
      <View style={styles.row}>
        <View style={[styles.box, { backgroundColor: theme.colors.surface, borderColor: theme.colors.divider, borderRadius: theme.radius.md }]}>
          {branch.logo_path ? (
            <Image
              source={{ uri: logoUrl(branch.logo_path) }}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel={t('branch.logo.title')}
              testID="logo-preview"
            />
          ) : (
            <Icon name="image" size={24} color={theme.colors.textSecondary} />
          )}
        </View>
        <View style={styles.flex}>
          <Text variant="bodyStrong">{t('branch.logo.title')}</Text>
          <Text variant="small" color="textSecondary">
            {t('branch.logo.hint')}
          </Text>
        </View>
      </View>
      <View style={styles.buttons}>
        <Button
          label={t(branch.logo_path ? 'branch.logo.change' : 'branch.logo.add')}
          icon="image"
          variant="outline"
          size="md"
          loading={picking || (setLogo.isPending && setLogo.variables !== null)}
          onPress={add}
          testID="logo-add"
        />
        {branch.logo_path ? (
          <Button
            label={t('branch.logo.remove')}
            icon="trash"
            variant="ghost"
            size="md"
            loading={setLogo.isPending && setLogo.variables === null}
            onPress={() => setLogo.mutate(null, { onSuccess: () => toast(t('branch.logo.removed')) })}
            testID="logo-remove"
          />
        ) : null}
      </View>
      <FormError error={pickError ?? setLogo.error} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  box: { width: 96, height: 64, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', padding: spacing.xs },
  logo: { width: '100%', height: '100%' },
  flex: { flex: 1, gap: 2 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
