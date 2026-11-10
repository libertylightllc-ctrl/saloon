import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { Avatar, Text, useOnBand } from '@/ui';

/** The customer's avatar, name and phone (when shown) in the header band. */
export function Profile({ name, phone }: { name: string; phone: string | null }) {
  const onBand = useOnBand();
  return (
    <View style={styles.profile}>
      <Avatar name={name} size={72} ring={onBand} />
      <Text variant="h3" align="center" color={onBand ? 'onPrimary' : 'text'}>
        {name}
      </Text>
      {phone ? (
        <Text variant="small" align="center" color={onBand ? 'onPrimary' : 'textOnTint'} tabular>
          {phone}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  profile: { alignItems: 'center', gap: spacing.xs },
});
