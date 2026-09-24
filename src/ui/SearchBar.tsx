import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput, View } from 'react-native';

import { spacing, useTheme } from '@/theme';

import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { START_ALIGN, useFontFamily } from './Text';

export interface SearchBarProps {
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  /** Shows the round (gents) / square (ladies) filter button at the end. */
  onFilter?: () => void;
  onSubmit?: () => void;
  /** Render as a button that opens the search screen. */
  onPress?: () => void;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder,
  onFilter,
  onSubmit,
  onPress,
}: SearchBarProps) {
  const theme = useTheme();
  const font = useFontFamily();
  const { t } = useTranslation();

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: theme.colors.surface, borderRadius: theme.radius.pill },
        theme.shadow,
      ]}
    >
      <Icon name="search" size={20} color={theme.colors.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        onPressIn={onPress}
        editable={!onPress}
        placeholder={placeholder ?? t('common.search')}
        placeholderTextColor={theme.colors.textSecondary}
        accessibilityLabel={placeholder ?? t('common.search')}
        returnKeyType="search"
        selectionColor={theme.colors.primary500}
        style={[
          styles.input,
          { fontFamily: font('regular'), color: theme.colors.text, textAlign: START_ALIGN },
        ]}
      />
      {onFilter ? (
        <IconButton
          icon="sliders"
          variant="filled"
          size={36}
          onPress={onFilter}
          accessibilityLabel={t('common.filter')}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingStart: spacing.lg,
    paddingEnd: spacing.sm,
    gap: spacing.sm,
  },
  input: { flex: 1, fontSize: 14, paddingVertical: spacing.sm },
});
