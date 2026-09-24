import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { formatMoney } from '@/lib/money';
import { contrastRatio, semantic, spacing, typeScale, useTheme, type TypeVariant } from '@/theme';
import { Text } from '@/ui';

import { galleryStyles, Section } from './Section';

function Swatch({ name, value }: { name: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.swatch}>
      <View style={[styles.chip, { backgroundColor: value, borderColor: theme.colors.divider }]} />
      <Text variant="micro" numberOfLines={1}>
        {name}
      </Text>
      <Text variant="micro" color="textSecondary" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export function ColourSection() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const scale = [
    'primary50',
    'primary100',
    'primary200',
    'primary300',
    'primary400',
    'primary500',
    'primary600',
    'primary700',
  ] as const;
  const roles = [
    'primaryAction',
    'primaryText',
    'background',
    'surface',
    'text',
    'textSecondary',
    'textOnTint',
    'accent',
  ] as const;
  const ratio = contrastRatio(colors.onPrimary, colors.primaryAction).toFixed(1);

  return (
    <Section title={t('gallery.sections.colours')}>
      <View style={galleryStyles.row}>
        {scale.map((key) => (
          <Swatch key={key} name={key} value={colors[key]} />
        ))}
      </View>
      <View style={galleryStyles.row}>
        {roles.map((key) => (
          <Swatch key={key} name={key} value={colors[key]} />
        ))}
      </View>
      <View style={galleryStyles.row}>
        {(Object.keys(semantic) as (keyof typeof semantic)[]).map((key) => (
          <Swatch key={key} name={key} value={semantic[key].main} />
        ))}
        {colors.categoryFills.map((fill, i) => (
          <Swatch key={`${fill}-${i}`} name={`category ${i + 1}`} value={fill} />
        ))}
      </View>
      <Text variant="small" color="textSecondary">
        {t('gallery.buttonContrast', { ratio })}
      </Text>
    </Section>
  );
}

export function TypeSection() {
  const { t } = useTranslation();
  return (
    <Section title={t('gallery.sections.type')}>
      {(Object.keys(typeScale) as TypeVariant[]).map((variant) => {
        const spec = typeScale[variant];
        return (
          <View key={variant} style={styles.typeRow}>
            <Text
              variant="micro"
              color="textSecondary"
            >{`${variant} · ${spec.fontSize}/${spec.lineHeight} · ${spec.weight}`}</Text>
            <Text variant={variant} numberOfLines={1}>
              {t('gallery.typeSample')}
            </Text>
          </View>
        );
      })}
      <Text variant="display" tabular>
        {formatMoney(124000)}
      </Text>
    </Section>
  );
}

const styles = StyleSheet.create({
  swatch: { width: 72, gap: 2 },
  chip: { height: 40, borderRadius: 10, borderWidth: 1 },
  typeRow: { gap: spacing.xs },
});
